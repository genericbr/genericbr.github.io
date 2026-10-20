"use strict";
const $ = (selector) => document.querySelector(selector);
const studio = { token: null, tab: "games", records: [], activeIndex: 0, loading: 0, busy: false, mediaTarget: null, media: [] };
const sections = {
  games: { title: "Jogos", description: "Informações, imagens e créditos dos jogos.", add: "+ Novo jogo", endpoint: "/api/games", key: "appId" },
  audiovisuals: { title: "Audiovisuais", description: "Vídeos, séries, episódios e imagens das suas obras.", add: "+ Nova obra", endpoint: "/api/audiovisuals", key: "id" },
  music: { title: "Músicas", description: "Vídeos, traduções e tags.", add: "+ Importar música", endpoint: "/api/manual-music", key: "id" },
  banners: { title: "Banners", description: "Imagens, mensagens e destinos dos banners.", add: "+ Criar banner", endpoint: "/api/banners", key: "id" },
  tracking: { title: "Links rastreáveis", description: "Crie links para acompanhar visitas ao seu portfólio.", add: "", endpoint: "/api/tracking/links", key: "id" }
};
const imageAccept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function safeURL(value, local = false) {
  if (!value) return "";
  try {
    const url = new URL(value, location.origin);
    return ["https:", "http:"].includes(url.protocol) && (local || /^https?:\/\//i.test(value)) ? url.href : "";
  } catch {
    return "";
  }
}
function notice(message) {
  $("#notice").textContent = message || "";
  $("#notice").hidden = !message;
}
function hasDirty() {
  return !!$('#editor-list form[data-dirty="true"]') || !!window.PortfolioTrackingAdmin?.hasDirty();
}
function markDirty(form) {
  if (!form?.isConnected) return;
  form.dataset.dirty = "true";
  const state = form.querySelector(".save-state");
  state.textContent = "Alterações não salvas";
  state.classList.add("dirty");
}
function canNavigate(message = "Há alterações não salvas. Deseja descartá-las?") {
  if (studio.busy || studio.loadingSection || window.PortfolioTrackingAdmin?.isBusy()) {
    notice("Aguarde a operação terminar antes de trocar de projeto.");
    return false;
  }
  return !hasDirty() || confirm(message);
}
function getStoredToken() {
  try {
    return sessionStorage.getItem("portfolioAdminToken");
  } catch {
    return null;
  }
}
async function request(path, options = {}) {
  try {
    return await PortfolioAPI.request(path, { ...options, token: studio.token });
  } catch (error) {
    if (error.status === 401) {
      logout(true);
      error.message = "Sua sessão expirou. Entre novamente.";
    }
    throw error;
  }
}
function showStudio(token) {
  studio.token = token;
  try {
    sessionStorage.setItem("portfolioAdminToken", token);
    localStorage.removeItem("adminToken");
  } catch {
  }
  $("#login-section").hidden = true;
  $("#admin-content").hidden = false;
  $("#logout").hidden = false;
  loadSection();
}
function logout(force = false) {
  if (!force && !canNavigate()) return;
  window.PortfolioTrackingAdmin?.reset();
  studio.token = null;
  studio.loadingSection = false;
  studio.records = [];
  studio.loading++;
  studio.mediaTarget = null;
  try {
    sessionStorage.removeItem("portfolioAdminToken");
    localStorage.removeItem("adminToken");
  } catch {
  }
  $("#media-dialog").close();
  $("#import-dialog").close();
  $("#admin-content").hidden = true;
  $("#login-section").hidden = false;
  $("#logout").hidden = true;
  $("#editor-list").replaceChildren();
  $("#record-list").replaceChildren();
  $("#admin-password").value = "";
  $("#admin-password").focus();
}
async function operation(form, task) {
  if (studio.busy || !form?.isConnected) return;
  studio.busy = true;
  form.inert = true;
  form.setAttribute("aria-busy", "true");
  const status = form.querySelector(":scope > .status");
  if (status) status.classList.remove("error");
  try {
    await task();
  } catch (error) {
    if (form.isConnected && status) {
      status.classList.add("error");
      status.textContent = error.message;
    }
  } finally {
    studio.busy = false;
    form.inert = false;
    form.removeAttribute("aria-busy");
  }
}
function imageField(name, title, value = "", purpose, extra = "", context = "") {
  const url = safeURL(value), attr = context ? 'data-episode-field="' + esc(name) + '"' : 'name="' + esc(name) + '"';
  return '<div class="media-field" data-image-shape="' + (name === "poster" ? "poster" : "wide") + '"><label>' + esc(title) + "<input " + attr + ' type="url" value="' + esc(value) + '" ' + extra + '></label><div class="image-preview"' + (url ? "" : " hidden") + "><img " + (url ? 'src="' + esc(url) + '"' : "") + ' alt="" loading="lazy"></div><div class="media-actions"><label class="upload-control">Enviar imagem<input type="file" accept="' + imageAccept + '" data-upload-field="' + esc(name) + '" data-upload-purpose="' + esc(purpose) + '"' + (context ? ' data-upload-context="episode"' : "") + '></label><button type="button" class="secondary" data-pick-image="' + esc(name) + '">Escolher existente</button><button type="button" class="secondary" data-clear-image="' + esc(name) + '">Limpar</button></div><p class="upload-status" data-upload-status="' + esc(name) + '" role="status" aria-live="polite"></p></div>';
}
function episodeEditor(episode = {}, index = 0) {
  const rowId = episode.id || crypto.randomUUID();
  return '<details class="episode-editor"' + (episode.id ? "" : " open") + '><summary class="episode-summary"><span class="episode-number">' + String(index + 1).padStart(2, "0") + '</span><span class="episode-summary-title">' + esc(episode.title || "Novo episódio") + '</span><span class="record-badge">' + (episode.published === false ? "Rascunho" : "Publicado") + '</span></summary><div class="episode-body">' + episodeInput("id", "", rowId, "hidden") + '<div class="row">' + episodeInput("title", "Título", episode.title || "", "text", 'required maxlength="300"') + episodeInput("url", "URL do vídeo", episode.url || "", "url", "required") + '</div><button type="button" class="secondary" data-import-video data-import-episode>Buscar dados do vídeo</button><p class="help">Preenche título, descrição e miniatura que estiverem vazios.</p>' + imageField("thumbnail", "Miniatura (URL)", episode.thumbnail || "", "thumbnail", "", "episode") + area("description", "Descrição", episode.description || "", 3, "episode") + '<details class="editor-details"><summary>Dados adicionais</summary><div class="row">' + episodeInput("viewCount", "Visualizações", episode.viewCount ?? 0, "number", 'min="0" step="1"') + episodeInput("publishedAt", "Publicado em", episode.publishedAt || "") + "</div></details>" + episodeInput("order", "", episode.order ?? index, "hidden") + '<label class="check-label"><input type="checkbox" data-episode-field="published" ' + (episode.published !== false ? "checked" : "") + '>Publicado</label><div class="episode-actions"><button type="button" class="secondary" data-move-episode="up" aria-label="Mover episódio para cima">↑ Subir</button><button type="button" class="secondary" data-move-episode="down" aria-label="Mover episódio para baixo">↓ Descer</button><button type="button" class="danger" data-remove-episode>Remover episódio</button></div><p class="episode-status upload-status" role="status"></p></div></details>';
}
function episodesEditor(record) {
  const episodes = Array.isArray(record.episodes) ? record.episodes : [];
  return '<section class="editor-section" data-editor-section="episodes" hidden><div class="section-heading"><h4>Episódios da série</h4><p>Abra um episódio para editar. Use as setas para definir a ordem.</p></div><div class="episodes-list">' + episodes.map(episodeEditor).join("") + '</div><button type="button" data-add-episode>+ Adicionar episódio</button><details class="episode-import"><summary>Adicionar vários vídeos</summary><label>URLs dos vídeos<textarea data-bulk-episodes rows="3" placeholder="Uma URL por linha"></textarea></label><p class="help">Até 50 vídeos por vez. Os episódios serão adicionados como rascunho.</p><button type="button" class="secondary" data-import-bulk>Importar episódios</button><p class="bulk-status status" role="status"></p></details></section>';
}
function tabbed(content) {
  const names = [["details", "Detalhes"], ...content.includes('data-editor-section="episodes"') ? [["episodes", "Episódios"]] : [], ["images", "Imagens"], ["publication", "Publicação"]];
  return '<div class="editor-tabs" role="tablist" aria-label="Etapas de edição">' + names.map(([key, label]) => '<button type="button" role="tab" data-editor-tab="' + key + '" aria-selected="' + (key === "details") + '">' + label + "</button>").join("") + "</div>" + content;
}
function field(name, title, value = "", type = "text", extra = "") {
  return "<label>" + esc(title) + '<input name="' + esc(name) + '" type="' + type + '" value="' + esc(value) + '" ' + extra + "></label>";
}
function area(name, title, value = "", rows = 3, context = "") {
  const attr = context ? ' data-episode-field="' + esc(name) + '"' : ' name="' + esc(name) + '"';
  return "<label>" + esc(title) + "<textarea" + attr + ' rows="' + rows + '">' + esc(value) + "</textarea></label>";
}
function check(name, title, checked = false) {
  return '<label class="check-label"><input type="checkbox" name="' + esc(name) + '" ' + (checked ? "checked" : "") + ">" + esc(title) + "</label>";
}
function tagField(record) {
  return field("tags", "Tags (separadas por vírgula)", (record.tags || []).map((t) => t.name || t).join(", "));
}
function episodeInput(name, title, value = "", type = "text", extra = "") {
  return "<label>" + esc(title) + '<input data-episode-field="' + esc(name) + '" type="' + type + '" value="' + esc(value) + '" ' + extra + "></label>";
}
function renderEditor(record, index) {
  const tab = studio.tab, name = record.name || record.title || "Novo item";
  let content = "";
  if (tab === "games") content = tabbed('<section class="editor-section" data-editor-section="details"><div class="section-heading"><h4>Identidade</h4></div><div class="row">' + field("appId", "Steam App ID", record.appId, "text", 'required pattern="[0-9]+" ' + (record._new ? "" : "readonly")) + field("name", "Nome do jogo", record.name, "text", 'required maxlength="200"') + '</div><div class="row">' + field("role", "Seu papel", record.role) + field("dev", "Desenvolvedora", record.dev) + '</div><div class="row">' + field("originalLanguage", "Idioma original", record.originalLanguage || "English") + field("releaseDate", "Lançamento", record.releaseDate) + "</div>" + area("note", "Nota ou estado do projeto", record.note, 2) + area("description", "Descrição", record.description, 4) + tagField(record) + '</section><section class="editor-section" data-editor-section="images" hidden>' + imageField("cover", "Capa horizontal (URL)", record.cover, "cover") + imageField("poster", "Pôster vertical (URL)", record.poster, "poster") + imageField("creditsImage", "Imagem dos créditos (URL)", record.creditsImage, "credits") + '</section><section class="editor-section" data-editor-section="publication" hidden>' + check("featured", "Priorizar este jogo", record.featured) + area("creditsChips", "Créditos: Nome | Papel", (record.creditsChips || []).map((c) => c.name + " | " + (c.role || "")).join("\n"), 4) + "</section>");
  else if (tab === "banners") content = tabbed('<section class="editor-section" data-editor-section="details"><div class="section-heading"><h4>Conteúdo do banner</h4></div>' + field("title", "Título", record.title, "text", 'required maxlength="140"') + area("subtitle", "Texto de apoio", record.subtitle, 2) + '</section><section class="editor-section" data-editor-section="images" hidden>' + imageField("image", "Imagem do banner (URL)", record.image, "banner", "required") + '</section><section class="editor-section" data-editor-section="publication" hidden><div class="row">' + field("href", "Destino (URL ou /games)", record.href || "/games", "text", "required") + field("label", "Texto do botão", record.label || "Conhecer projeto") + "</div>" + field("order", "Ordem", record.order || 0, "number", 'min="0" step="1"') + check("enabled", "Publicado", record.enabled !== false) + "</section>");
  else if (tab === "music") content = tabbed('<section class="editor-section" data-editor-section="details"><div class="section-heading"><h4>Tradução</h4></div>' + field("title", "Título", record.title) + field("url", "URL do vídeo", record.url, "url") + tagField(record) + '</section><section class="editor-section" data-editor-section="images" hidden>' + imageField("thumbnail", "Miniatura (URL)", record.thumbnail, "thumbnail") + '</section><section class="editor-section" data-editor-section="publication" hidden>' + area("lyrics", "Letra / Tradução", record.lyrics, 9) + "</section>");
  else {
    content = tabbed('<section class="editor-section" data-editor-section="details"><div class="section-heading"><h4>Obra</h4></div>' + field("title", "Título", record.title, "text", "required") + '<div class="row"><label>Formato<select name="format"><option value="short-film" ' + (record.format !== "series" ? "selected" : "") + '>Curta-metragem</option><option value="series" ' + (record.format === "series" ? "selected" : "") + ">Série</option></select></label>" + field("url", "URL do vídeo", record.url, "url") + '<button type="button" class="secondary" data-import-work>Importar dados</button><label>Plataforma<select name="provider">' + ["youtube", "vimeo", "other"].map((p) => '<option value="' + p + '" ' + (record.provider === p ? "selected" : "") + ">" + p + "</option>").join("") + "</select></label></div>" + field("type", "Tipo de projeto", record.type) + '<div class="row">' + field("role", "Seu papel", record.role) + field("client", "Cliente", record.client) + field("year", "Ano", record.year) + field("duration", "Duração", record.duration) + "</div>" + area("description", "Descrição", record.description, 4) + tagField(record) + "</section>" + episodesEditor(record) + '<section class="editor-section" data-editor-section="images" hidden>' + imageField("cover", "Capa horizontal (URL)", record.cover, "cover") + imageField("poster", "Pôster vertical (URL)", record.poster, "poster") + imageField("thumbnail", "Miniatura do vídeo (URL)", record.thumbnail, "thumbnail") + '</section><section class="editor-section" data-editor-section="publication" hidden>' + field("order", "Ordem", record.order || 0, "number", 'step="1"') + check("published", "Publicado", record.published !== false) + check("featured", "Destaque", record.featured) + check("showcase", "Showcase (vídeo sem crédito)", record.showcase === true) + "</section>");
  }
  return '<article class="editor-card" data-index="' + index + '"><form data-index="' + index + '"><div class="editor-heading"><div><h3>' + esc(name) + '</h3><span class="record-status">' + (record._new ? "Novo rascunho" : "Editando") + '</span></div><span class="save-state">Sem alterações</span></div>' + content + '<div class="form-actions"><button type="submit">Salvar alterações</button>' + (tab !== "music" || record.manual ? '<button type="button" class="danger" data-delete>Excluir</button>' : "") + '</div><p class="status" role="status"></p></form></article>';
}
function isPublicRecord(record) {
  return !record._new && record.status !== "draft" && record.published !== false && record.enabled !== false;
}
function recordTitle(record) {
  return record.name || record.title || (studio.tab === "games" ? "Novo jogo" : "Nova obra");
}
function renderRecordList() {
  const query = $("#admin-search").value.toLowerCase().trim(), filter = $("#admin-filter").value;
  const items = studio.records.map((record, index) => ({ record, index })).filter(({ record }) => {
    const hay = [record.name, record.title, record.appId, record.id, record.url].join(" ").toLowerCase();
    return hay.includes(query) && (filter === "all" || filter === "published" && isPublicRecord(record) || filter === "draft" && !isPublicRecord(record) || filter === "series" && record.format === "series" || filter === "showcase" && record.showcase === true);
  });
  $("#record-list").replaceChildren(...items.map(({ record, index }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "record-item";
    button.dataset.selectRecord = index;
    if (index === studio.activeIndex) button.setAttribute("aria-current", "true");
    const image = safeURL(record.cover || record.thumbnail || record.poster || record.image);
    button.innerHTML = (image ? '<span class="record-image"><img src="' + esc(image) + '" alt="" loading="lazy"></span>' : '<span class="record-placeholder" aria-hidden="true">◈</span>') + '<span class="record-info"><strong class="record-name">' + esc(recordTitle(record)) + '</strong><small class="record-meta">' + esc(record.format === "series" ? (record.episodes?.length || 0) + " episódios" : studio.tab === "audiovisuals" ? "Curta-metragem" : sections[studio.tab].title) + (isPublicRecord(record) ? "" : " · Rascunho") + "</small></span>";
    return button;
  }));
  $("#admin-count").textContent = items.length + " de " + studio.records.length + " itens";
  $("#admin-no-results").hidden = !!items.length || !studio.records.length;
}
function setEditorTab(form, name) {
  const button = form.querySelector('[data-editor-tab="' + name + '"]');
  if (!button || button.hidden) name = "details";
  form.dataset.activePanel = name;
  form.querySelectorAll("[data-editor-tab]").forEach((tab) => {
    const active = tab.dataset.editorTab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  form.querySelectorAll("[data-editor-section]").forEach((panel) => panel.hidden = panel.dataset.editorSection !== name);
}
function syncFormatUI(form) {
  if (!form) return;
  const series = form.elements.format?.value === "series", episodePanel = form.querySelector('[data-editor-section="episodes"]');
  if (episodePanel) {
    form.querySelector('[data-editor-tab="episodes"]').hidden = !series;
    episodePanel.querySelectorAll("input,textarea,select,button").forEach((control) => control.disabled = !series);
  }
  if (form.elements.format && form.elements.url) {
    form.elements.url.closest("label").hidden = series;
    form.elements.url.required = !series && form.elements.published.checked;
    form.querySelector("[data-import-work]").hidden = series;
    const source = form.querySelector(".video-source");
    if (source) source.hidden = series;
    let note = form.querySelector(".format-note");
    if (!note) { note = document.createElement("p"); note.className = "format-note help"; form.elements.format.closest(".row").after(note); }
    note.textContent = "Os episódios ficam guardados ao usar o formato curta-metragem. Selecione Série para editá-los novamente.";
    note.hidden = series || !form.querySelector(".episode-editor");
  }
  setEditorTab(form, form.dataset.activePanel || "details");
}
function syncEpisodeRows(form) {
  const rows = [...form.querySelectorAll(".episode-editor")];
  rows.forEach((row, index) => {
    row.querySelector('[data-episode-field="order"]').value = index;
    row.querySelector(".episode-number").textContent = String(index + 1).padStart(2, "0");
    row.querySelector(".episode-summary-title").textContent = row.querySelector('[data-episode-field="title"]').value || "Novo episódio";
    row.querySelector(".record-badge").textContent = row.querySelector('[data-episode-field="published"]').checked ? "Publicado" : "Rascunho";
    row.querySelector('[data-move-episode="up"]').disabled = index === 0;
    row.querySelector('[data-move-episode="down"]').disabled = index === rows.length - 1;
  });
}
function bannerPreview(form) {
  const panel = form.querySelector('[data-editor-section="images"]');
  let preview = panel.querySelector(".banner-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.className = "banner-preview";
    panel.prepend(preview);
  }
  const url = safeURL(form.elements.image.value);
  preview.innerHTML = (url ? '<img src="' + esc(url) + '" alt="">' : "") + "<div><small>PRÉVIA DO BANNER</small><h3>" + esc(form.elements.title.value || "Título do banner") + "</h3><p>" + esc(form.elements.subtitle.value) + "</p><span>" + esc(form.elements.label.value || "Conhecer projeto") + " ↗</span></div>";
}
function renderRecords() {
  renderRecordList();
  if (!studio.records.length) {
    $("#editor-list").innerHTML = '<div class="state">Nenhum item nesta categoria. Crie o primeiro pelo botão acima.</div>';
    return;
  }
  studio.activeIndex = Math.max(0, Math.min(studio.activeIndex, studio.records.length - 1));
  const record = studio.records[studio.activeIndex];
  $("#editor-list").innerHTML = renderEditor(record, studio.activeIndex);
  const form = $("#editor-list form");
  form.querySelector("h3").textContent = recordTitle(record);
  if (form.elements.format) {
    const importButton = form.querySelector("[data-import-work]");
    const source = document.createElement("div");
    source.className = "video-source";
    importButton.closest(".row").after(source);
    source.append(form.elements.url.closest("label"), importButton);
  }
  form.querySelector('[data-editor-section="images"]').classList.add("image-grid");
  form.querySelectorAll("[data-editor-section]").forEach((panel) => panel.setAttribute("role", "tabpanel"));
  if (studio.tab === "music") {
    form.querySelector('[data-editor-tab="publication"]').textContent = "Letra / tradução";
    if (!record.manual) {
      form.elements.title.readOnly = true;
      form.elements.url.readOnly = true;
      form.elements.thumbnail.readOnly = true;
      form.querySelector(".media-actions").hidden = true;
      const help = document.createElement("p");
      help.className = "help";
      help.textContent = "Título e imagem vêm da playlist do YouTube. Tags e tradução podem ser editadas aqui.";
      form.querySelector('[data-editor-section="details"]').prepend(help);
    }
  }
  form.querySelector(".record-status").textContent = isPublicRecord(record) ? "Publicado" : "Rascunho";
  form.querySelector(".record-status").classList.add(isPublicRecord(record) ? "published" : "draft");
  syncFormatUI(form);
  syncEpisodeRows(form);
  if (studio.tab === "banners") bannerPreview(form);
  if (record._new) markDirty(form);
}
async function loadSection() {
  window.PortfolioTrackingAdmin?.reset();
  $(".workspace").classList.toggle("tracking-workspace", studio.tab === "tracking");
  $("#editor-list").classList.remove("tracking-root");
  $("#add-item").hidden = studio.tab === "tracking";
  studio.loadingSection = true;
  $("#add-item").disabled = true;
  const tab = studio.tab, section = sections[tab], generation = ++studio.loading;
  studio.mediaTarget = null;
  $("#media-dialog").close();
  $("#record-list").replaceChildren();
  $("#admin-count").textContent = "";
  $("#section-title").textContent = section.title;
  $("#section-description").textContent = section.description;
  $("#add-item").textContent = section.add;
  $("#admin-search").value = "";
  $("#admin-filter").value = "all";
  $("#admin-no-results").hidden = true;
  $("#admin-filter").querySelectorAll("option").forEach((option) => option.hidden = ["series", "showcase"].includes(option.value) && tab !== "audiovisuals");
  $("#editor-list").innerHTML = '<div class="state">Carregando projetos…</div>';
  notice("");
  try {
    if (tab === "tracking") {
      studio.records = [];
      await window.PortfolioTrackingAdmin.render({ request, container: $("#editor-list"), notify: notice, upload: file => PortfolioAPI.upload("/api/uploads/images", file, "banner", studio.token) });
      return;
    }
    let items;
    if (tab === "music") {
      const [playlist, manual] = await Promise.all([request("/?admin=true"), request("/api/manual-music?admin=true")]);
      const merged = /* @__PURE__ */ new Map();
      playlist.forEach((item) => merged.set(item.id, { ...item, manual: false }));
      manual.forEach((item) => merged.set(item.id, { ...item, manual: true }));
      items = [...merged.values()];
    } else items = await request(section.endpoint + "?admin=true");
    if (!Array.isArray(items)) throw new Error("O servidor não retornou uma lista válida.");
    if (tab === "games") items = await Promise.all(items.map(async (game) => {
      const id = encodeURIComponent(game.appId), [tags, credits] = await Promise.all([request("/api/games/tags?id=" + id), request("/api/game/credits?id=" + id)]);
      return { ...game, tags: tags.tags || [], ...credits };
    }));
    if (generation !== studio.loading || !studio.token) return;
    studio.records = items;
    studio.activeIndex = 0;
    renderRecords();
  } catch (error) {
    if (generation !== studio.loading) return;
    studio.records = [];
    renderRecordList();
    $("#editor-list").innerHTML = '<div class="state">' + esc(error.message) + '<button type="button" data-retry>Tentar novamente</button></div>';
  } finally {
    if (generation === studio.loading) { studio.loadingSection = false; $("#add-item").disabled = false; }
  }
}
function imageInput(control) {
  return control.closest(".media-field")?.querySelector('input[type="url"]');
}
function setInput(input, value) {
  if (!input?.isConnected) return;
  input.value = value ?? "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function updateImage(input) {
  const preview = input.closest(".media-field")?.querySelector(".image-preview");
  if (!preview) return;
  const url = safeURL(input.value);
  preview.hidden = !url;
  const image = preview.querySelector("img");
  if (url) { image.hidden = false; image.src = url; }
  else image.removeAttribute("src");
}
async function uploadImage(input) {
  const form = input.closest("form"), file = input.files?.[0], target = imageInput(input), status = input.closest(".media-field").querySelector(".upload-status");
  if (!file || studio.busy) return;
  if (file.size > 10 * 1024 * 1024 || !imageAccept.split(",").includes(file.type)) {
    status.textContent = "Escolha uma imagem JPG, PNG, WebP, GIF ou AVIF de até 10 MiB.";
    status.classList.add("error");
    input.value = "";
    return;
  }
  await operation(form, async () => {
    status.classList.remove("error");
    status.textContent = "Enviando imagem…";
    input.dataset.uploading = "true";
    try {
      const result = await PortfolioAPI.upload("/api/uploads/images", file, input.dataset.uploadPurpose, studio.token);
      const url = safeURL(result?.url);
      if (!url) throw new Error("O servidor não retornou uma imagem válida.");
      if (target.isConnected) {
        setInput(target, url);
        status.textContent = "Imagem enviada. Salve o item para aplicar.";
      }
    } catch (error) {
      if (error.status === 401) logout(true);
      status.classList.add("error");
      status.textContent = error.message;
    } finally {
      delete input.dataset.uploading;
      input.value = "";
    }
  });
}
async function importVideo(form, row) {
  const target = (name) => row ? row.querySelector('[data-episode-field="' + name + '"]') : form.elements[name];
  const url = target("url")?.value.trim(), status = row?.querySelector(".episode-status") || form.querySelector(":scope > .status");
  if (!safeURL(url)) {
    status.textContent = "Informe uma URL válida para buscar os dados.";
    return;
  }
  await operation(form, async () => {
    status.textContent = "Buscando dados do vídeo…";
    const info = await request("/api/fetch-video-info?url=" + encodeURIComponent(url));
    if (!form.isConnected || row && !row.isConnected) return;
    for (const name of ["title", "description", "thumbnail", "publishedAt"]) if (target(name) && !target(name).value.trim()) setInput(target(name), info[name] || "");
    if (target("viewCount")) setInput(target("viewCount"), info.viewCount || 0);
    if (!row) { form.dataset.importSource = url; form.dataset.imported = JSON.stringify({ viewCount: info.viewCount || 0, publishedAt: info.publishedAt || "", channelTitle: info.channelTitle || "", channelId: info.channelId || "" }); }
    markDirty(form);
    syncEpisodeRows(form);
    status.textContent = "Dados importados nos campos vazios. Revise e salve.";
  });
}
function appendEpisode(form, record) {
  const list = form.querySelector(".episodes-list");
  list.insertAdjacentHTML("beforeend", episodeEditor(record, list.children.length));
  list.lastElementChild.open = true;
  syncEpisodeRows(form);
  markDirty(form);
}
async function importBulk(form) {
  const textarea = form.querySelector("[data-bulk-episodes]"), status = form.querySelector(".bulk-status");
  const urls = [...new Set(textarea.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
  if (!urls.length || urls.length > 50 || urls.some((url) => !safeURL(url))) {
    status.textContent = "Informe de 1 a 50 URLs válidas, uma por linha.";
    return;
  }
  if (form.querySelectorAll(".episode-editor").length + urls.length > 200) {
    status.textContent = "Uma série pode ter até 200 episódios.";
    return;
  }
  await operation(form, async () => {
    let failed = 0;
    for (let index = 0; index < urls.length; index++) {
      status.textContent = "Importando " + (index + 1) + " de " + urls.length + "…";
      let info = {};
      try {
        info = await request("/api/fetch-video-info?url=" + encodeURIComponent(urls[index]));
      } catch (error) {
        if (error.status === 401) throw error;
        failed++;
      }
      if (!form.isConnected) return;
      appendEpisode(form, { ...info, id: void 0, url: urls[index], title: info.title || "Episódio " + (form.querySelectorAll(".episode-editor").length + 1), published: false });
      form.querySelector(".episode-editor:last-child").open = false;
    }
    textarea.value = "";
    status.textContent = urls.length + " episódios adicionados como rascunho." + (failed ? " " + failed + " vídeos precisam de revisão manual dos dados." : "");
  });
}
async function openMedia(form, input) {
  if (studio.busy || !input) return;
  studio.mediaTarget = input;
  $("#media-search").value = "";
  $("#media-grid").replaceChildren();
  $("#media-status").textContent = "Carregando imagens…";
  $("#media-dialog").showModal();
  await operation(form, async () => {
    const images = [];
    const add = (record) => {
      for (const key of ["image", "cover", "poster", "thumbnail", "creditsImage"]) if (safeURL(record[key])) images.push({ url: safeURL(record[key]), title: record.name || record.title || "Imagem do portfólio" });
      (Array.isArray(record.episodes) ? record.episodes : []).forEach((episode) => {
        if (safeURL(episode.thumbnail)) images.push({ url: safeURL(episode.thumbnail), title: episode.title || record.title });
      });
    };
    studio.records.forEach(add);
    form.querySelectorAll(".media-field input[type=url]").forEach((field2) => {
      if (safeURL(field2.value)) images.push({ url: safeURL(field2.value), title: field2.closest("label").firstChild.textContent });
    });
    const results = await Promise.allSettled(Object.entries(sections).filter(([name]) => name !== "tracking").map(([, section]) => request(section.endpoint + "?admin=true")));
    results.forEach((result) => {
      if (result.status === "fulfilled" && Array.isArray(result.value)) result.value.forEach(add);
    });
    if (!studio.token || !input.isConnected || studio.mediaTarget !== input || !$("#media-dialog").open) return;
    studio.media = [...new Map(images.map((image) => [image.url, image])).values()];
    $("#media-status").textContent = studio.media.length + " imagens disponíveis." + (results.some((result) => result.status === "rejected") ? " Algumas categorias não puderam ser carregadas." : "");
    renderMedia();
  });
}
function renderMedia() {
  const query = $("#media-search").value.toLowerCase().trim(), images = studio.media.filter((image) => image.title.toLowerCase().includes(query));
  $("#media-grid").replaceChildren(...images.map((image) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mediaUrl = image.url;
    button.innerHTML = '<img src="' + esc(image.url) + '" alt="" loading="lazy"><span>' + esc(image.title) + "</span>";
    return button;
  }));
  if (!images.length) $("#media-status").textContent = "Nenhuma imagem corresponde à busca.";
}
function readFields(form, record) {
  const values = Object.fromEntries(new FormData(form));
  form.querySelectorAll("input[type=checkbox][name]").forEach((input) => values[input.name] = input.checked);
  if ("order" in values) values.order = Number(values.order) || 0;
  if (form.elements.format) {
    values.episodes = [...form.querySelectorAll(".episode-editor")].map((row, index) => {
      const idInput = row.querySelector("[data-episode-field=id]");
      if (!idInput.value) idInput.value = crypto.randomUUID();
      const episode = { ...(record.episodes || []).find((item) => item.id === idInput.value) };
      row.querySelectorAll("[data-episode-field]").forEach((input) => episode[input.dataset.episodeField] = input.type === "checkbox" ? input.checked : input.value);
      episode.order = index;
      episode.viewCount = Number(episode.viewCount) || 0;
      if (!episode.title.trim() || !safeURL(episode.url)) throw new Error("Complete o título e a URL de todos os episódios na aba Episódios.");
      return episode;
    });
  }
  for (const name of ["image", "cover", "poster", "thumbnail", "creditsImage", "url"]) if (values[name] && !safeURL(values[name])) throw new Error("Use uma URL HTTP ou HTTPS válida no campo " + name + ".");
  if (values.href && !safeURL(values.href, true)) throw new Error("Informe um destino válido para o banner.");
  return values;
}
async function saveTags(type, id, original, value) {
  const nextNames = [...new Set((value || "").split(",").map((name) => name.trim()).filter(Boolean))];
  if (nextNames.some((name) => name.length > 80)) throw new Error("Cada tag pode ter no máximo 80 caracteres.");
  const old = (original || []).map((tag) => typeof tag === "string" ? { name: tag } : tag);
  const endpoint = "/api/" + (type === "games" ? "games" : type === "music" ? "music" : "audiovisuals") + "/tags";
  for (const name of nextNames) if (!old.some((tag) => tag.name === name)) await request(endpoint, { method: "POST", body: { id, tag: { name, color: "#6b7194" } } });
  for (const tag of old) if (!nextNames.includes(tag.name)) await request(endpoint + "?id=" + encodeURIComponent(id) + "&tag=" + encodeURIComponent(tag.name), { method: "DELETE" });
  return nextNames.map((name) => old.find((tag) => tag.name === name) || { name, color: "#6b7194" });
}
$("#editor-list").addEventListener("submit", async (event) => {
  if (studio.tab === "tracking") return;
  event.preventDefault();
  const form = event.target, index = Number(form.dataset.index), record = studio.records[index], type = studio.tab;
  if (!record || studio.busy) return;
  let values;
  try {
    values = readFields(form, record);
  } catch (error) {
    form.querySelector(":scope > .status").textContent = error.message;
    return;
  }
  await operation(form, async () => {
    const status = form.querySelector(":scope > .status");
    status.textContent = "Salvando…";
    let saved = { ...record };
    try {
      if (type !== "music" || record.manual) {
        const imported = form.dataset.importSource === values.url ? JSON.parse(form.dataset.imported || "{}") : {};
        const resetVideo = type === "audiovisuals" && values.url !== record.url ? {viewCount:0,publishedAt:"",channelTitle:"",channelId:""} : {};
        const body = { ...record, ...resetVideo, ...imported, ...values };
        for (const key of ["_new", "manual", "tags", "lyrics", "creditsChips", "creditsImage"]) delete body[key];
        const response = await request(sections[type].endpoint, { method: "POST", body });
        saved = { ...record, ...body, ...response, _new: false };
        if (form.isConnected) {
          studio.records[index] = saved;
          if (type === "games") form.elements.appId.readOnly = true;
        }
      }
      const id = saved[sections[type].key];
      if (type === "music") {
        await request("/api/music/lyrics", { method: "POST", body: { id, lyrics: values.lyrics || "" } });
        saved.lyrics = values.lyrics || "";
      }
      if (type === "games") {
        const previous = record.creditsChips || [];
        const creditsChips = values.creditsChips.split("\n").filter((line) => line.trim()).map((line) => {
          const [name, ...role] = line.split("|");
          return { ...previous.find((item) => item.name === name.trim()), name: name.trim(), role: role.join("|").trim() };
        });
        await request("/api/game/credits", { method: "POST", body: { id, creditsChips, creditsImage: values.creditsImage || "" } });
        saved.creditsChips = creditsChips;
        saved.creditsImage = values.creditsImage || "";
      }
      if (type !== "banners") saved.tags = await saveTags(type, id, record.tags, values.tags);
      if (!form.isConnected) return;
      studio.records[index] = saved;
      if (Array.isArray(saved.episodes)) form.querySelectorAll(".episode-editor").forEach((row, i) => {
        if (saved.episodes[i]) row.querySelector("[data-episode-field=id]").value = saved.episodes[i].id;
      });
      form.dataset.dirty = "false";
      form.querySelector(".save-state").textContent = "Salvo";
      form.querySelector(".save-state").classList.remove("dirty");
      form.querySelector("h3").textContent = recordTitle(saved);
      form.querySelector(".record-status").textContent = isPublicRecord(saved) ? "Publicado" : "Rascunho";
      form.querySelector(".record-status").className = "record-status " + (isPublicRecord(saved) ? "published" : "draft");
      renderRecordList();
      status.textContent = "Salvo. O cache público foi invalidado.";
    } catch (error) {
      if (form.isConnected) markDirty(form);
      throw new Error("Não foi possível concluir o salvamento. Algumas alterações podem ter sido aplicadas. " + error.message + " Revise e tente novamente.");
    }
  });
});
$("#editor-list").addEventListener("input", (event) => {
  if (studio.tab === "tracking") return;
  const form = event.target.closest("form");
  if (!form) return;
  markDirty(form);
  if (event.target.matches('.media-field input[type="url"]')) updateImage(event.target);
  if (event.target.name === "url") { delete form.dataset.imported; delete form.dataset.importSource; }
  if (event.target.closest(".episode-editor")) syncEpisodeRows(form);
  if (studio.tab === "banners") bannerPreview(form);
});
$("#editor-list").addEventListener("change", (event) => {
  if (studio.tab === "tracking") return;
  const form = event.target.closest("form");
  if (!form) return;
  if (event.target.matches("input[type=file]")) {
    uploadImage(event.target);
    return;
  }
  markDirty(form);
  if (event.target.name === "format" && event.target.value === "series" && !form.querySelector(".episode-editor") && form.elements.url.value.trim()) appendEpisode(form, { title: form.elements.title.value, url: form.elements.url.value, thumbnail: form.elements.thumbnail.value, description: form.elements.description.value, published: false });
  syncFormatUI(form);
  syncEpisodeRows(form);
});
$("#editor-list").addEventListener("click", async (event) => {
  if (studio.tab === "tracking") return;
  if (event.target.closest("[data-retry]")) {
    if (!studio.busy) loadSection();
    return;
  }
  const form = event.target.closest("form");
  if (!form || studio.busy) return;
  const tab = event.target.closest("button[data-editor-tab]");
  if (tab) {
    setEditorTab(form, tab.dataset.editorTab);
    return;
  }
  const picker = event.target.closest("[data-pick-image]");
  if (picker) {
    await openMedia(form, imageInput(picker));
    return;
  }
  const clear = event.target.closest("[data-clear-image]");
  if (clear) {
    setInput(imageInput(clear), "");
    return;
  }
  if (event.target.closest("[data-import-work],[data-import-video]")) {
    await importVideo(form, event.target.closest(".episode-editor"));
    return;
  }
  if (event.target.closest("[data-import-bulk]")) {
    await importBulk(form);
    return;
  }
  if (event.target.closest("[data-add-episode]")) {
    if (form.querySelectorAll(".episode-editor").length >= 200) {
      form.querySelector(":scope > .status").textContent = "Limite de 200 episódios atingido.";
      return;
    }
    appendEpisode(form, { published: false });
    return;
  }
  const remove = event.target.closest("[data-remove-episode]");
  if (remove) {
    const row = remove.closest(".episode-editor");
    if (!confirm("Remover este episódio? A remoção será aplicada ao salvar a obra.")) return;
    row.remove();
    syncEpisodeRows(form);
    markDirty(form);
    return;
  }
  const move = event.target.closest("[data-move-episode]");
  if (move) {
    const row = move.closest(".episode-editor"), list = row.parentElement;
    if (move.dataset.moveEpisode === "up" && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    if (move.dataset.moveEpisode === "down" && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    syncEpisodeRows(form);
    markDirty(form);
    return;
  }
  if (event.target.closest("[data-delete]")) {
    const record = studio.records[Number(form.dataset.index)];
    if (!confirm("Excluir “" + recordTitle(record) + "”?")) return;
    if (record._new) {
      studio.records.splice(studio.activeIndex, 1);
      studio.activeIndex = 0;
      renderRecords();
      return;
    }
    await operation(form, async () => {
      await request(sections[studio.tab].endpoint + "?" + sections[studio.tab].key + "=" + encodeURIComponent(record[sections[studio.tab].key]), { method: "DELETE" });
      await loadSection();
    });
  }
});
$("#editor-list").addEventListener("invalid", (event) => {
  const panel = event.target.closest("[data-editor-section]"), form = event.target.closest("form");
  if (!panel || !form) return;
  const row = event.target.closest(".episode-editor");
  if (row) row.open = true;
  const details = event.target.closest("details");
  if (details) details.open = true;
  setEditorTab(form, panel.dataset.editorSection);
}, true);
$("#editor-list").addEventListener("keydown", (event) => {
  const tab = event.target.closest("button[data-editor-tab]");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...tab.parentElement.querySelectorAll("button:not([hidden])")], i = tabs.indexOf(tab);
  const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  setEditorTab(tab.closest("form"), next.dataset.editorTab);
  next.focus();
});
$("#record-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-record]");
  if (!button || Number(button.dataset.selectRecord) === studio.activeIndex || !canNavigate()) return;
  studio.activeIndex = Number(button.dataset.selectRecord);
  renderRecords();
  if (matchMedia("(max-width:760px)").matches) $("#editor-list").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#admin-search").addEventListener("input", renderRecordList);
$("#admin-filter").addEventListener("change", renderRecordList);
$(".tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button || button.dataset.tab === studio.tab || !canNavigate()) return;
  studio.tab = button.dataset.tab;
  $(".tabs").querySelectorAll("button").forEach((tab) => tab.removeAttribute("aria-current"));
  button.setAttribute("aria-current", "page");
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  loadSection();
});
$("#add-item").addEventListener("click", () => {
  if (!canNavigate()) return;
  if (studio.tab === "music") {
    $("#import-form").reset();
    $("#import-dialog .status").textContent = "";
    $("#import-dialog").showModal();
    return;
  }
  const record = studio.tab === "games" ? { appId: "", name: "", tags: [], creditsChips: [] } : studio.tab === "banners" ? { id: crypto.randomUUID(), title: "", enabled: false, order: 0 } : { id: crypto.randomUUID(), title: "", format: "short-film", episodes: [], published: false, showcase: false, featured: false, order: 0 };
  studio.records.unshift({ ...record, _new: true });
  studio.activeIndex = 0;
  $("#admin-search").value = "";
  $("#admin-filter").value = "all";
  renderRecords();
  $("#editor-list input:not([type=hidden])").focus();
});
$("#refresh").addEventListener("click", async () => {
  if (!canNavigate("Há alterações não salvas. Deseja descartá-las para atualizar?")) return;
  const button = $("#refresh");
  button.disabled = true;
  studio.busy = true;
  try {
    if (studio.tab !== "tracking") {
      await request("/refresh", { method: "POST" });
      PortfolioAPI.clear();
    }
    await loadSection();
    notice("Dados atualizados.");
  } catch (error) {
    notice(error.message);
  } finally {
    button.disabled = false;
    studio.busy = false;
  }
});
$("#media-dialog").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-media]")) {
    $("#media-dialog").close();
    return;
  }
  const choice = event.target.closest("[data-media-url]");
  if (!choice || studio.busy) return;
  setInput(studio.mediaTarget, choice.dataset.mediaUrl);
  $("#media-dialog").close();
});
$("#media-dialog").addEventListener("close", () => studio.mediaTarget = null);
$("#media-search").addEventListener("input", renderMedia);
$("#import-dialog .dialog-close").addEventListener("click", () => {
  if (!studio.busy) $("#import-dialog").close();
});
$("#import-dialog").addEventListener("cancel", (event) => {
  if (studio.busy) event.preventDefault();
});
$("#import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  await operation(form, async () => {
    form.querySelector(":scope > .status").textContent = "Buscando vídeo…";
    const url = $("#video-url").value.trim(), info = await request("/api/fetch-video-info?url=" + encodeURIComponent(url));
    await request("/api/manual-music", { method: "POST", body: { ...info, url } });
    $("#import-dialog").close();
    await loadSection();
  });
});
$("#logout").addEventListener("click", () => logout());
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#login-btn");
  button.disabled = true;
  $("#login-error").textContent = "";
  try {
    const data = await PortfolioAPI.request("/auth", { method: "POST", body: { password: $("#admin-password").value } });
    if (!data.token) throw new Error("O servidor não retornou uma sessão válida.");
    $("#admin-password").value = "";
    showStudio(data.token);
  } catch (error) {
    $("#login-error").textContent = error.status === 401 ? "Senha incorreta." : error.message;
  } finally {
    button.disabled = false;
  }
});
window.addEventListener("beforeunload", (event) => {
  if (hasDirty() || studio.busy || window.PortfolioTrackingAdmin?.isBusy()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
$("#editor-list").addEventListener("error", (event) => {
  if (event.target.matches("img")) event.target.hidden = true;
}, true);
(async function restoreSession() {
  const token = getStoredToken();
  if (!token) return;
  try {
    await PortfolioAPI.request("/auth/check", { token });
    showStudio(token);
  } catch (error) {
    if (error.status === 401) logout(true);
    else $("#login-error").textContent = "Não foi possível verificar a sessão. Entre novamente.";
  }
})();
