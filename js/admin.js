/* Content studio. Each form owns its record; requests and caching live in api.js. */
'use strict';
const $ = selector => document.querySelector(selector);
const studio = { token: null, tab: 'games', records: [], loading: 0 };
const sections = {
  games: { title: 'Jogos', description: 'Informações, imagens e créditos dos jogos.', add: '+ Novo jogo', endpoint: '/api/games', key: 'appId' },
  banners: { title: 'Banners', description: 'Imagem, mensagem e destino. Use imagens em 1600 × 600 px para melhor resultado.', add: '+ Criar banner', endpoint: '/api/banners', key: 'id' },
  music: { title: 'Músicas', description: 'Importe vídeos, edite traduções e organize suas tags.', add: '+ Importar música', endpoint: '/api/manual-music', key: 'id' },
  audiovisuals: { title: 'Audiovisuais', description: 'Obras, formatos, episódios e publicação das traduções.', add: '+ Nova obra', endpoint: '/api/audiovisuals', key: 'id' }
};
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeURL(value, local = false) {
  if (!value) return '';
  try {
    const url = new URL(value, location.origin);
    return ['https:', 'http:'].includes(url.protocol) && (local || /^https?:\/\//i.test(value)) ? url.href : '';
  } catch { return ''; }
}
function request(path, options = {}) {
  return PortfolioAPI.request(path, { ...options, token: studio.token }).catch(error => {
    if (error.status === 401) { logout(); error.message = 'Sua sessão expirou. Entre novamente.'; }
    throw error;
  });
}
function notice(message) { $('#notice').textContent = message; $('#notice').hidden = !message; }
function getStoredToken() { try { return sessionStorage.getItem('portfolioAdminToken'); } catch { return null; } }
function showStudio(token) {
  studio.token = token;
  try { sessionStorage.setItem('portfolioAdminToken', token); localStorage.removeItem('adminToken'); } catch { /* Session still works when storage is disabled. */ }
  $('#login-section').hidden = true; $('#admin-content').hidden = false; $('#logout').hidden = false;
  loadSection();
}
function logout() {
  studio.token = null; studio.records = []; studio.loading++;
  try { sessionStorage.removeItem('portfolioAdminToken'); localStorage.removeItem('adminToken'); } catch { /* Browser storage may be blocked. */ }
  $('#admin-content').hidden = true; $('#login-section').hidden = false; $('#logout').hidden = true; $('#editor-list').replaceChildren();
  $('#admin-password').value = ''; $('#admin-password').focus();
}
$('#logout').addEventListener('click', logout);
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#login-btn'); button.disabled = true;
  $('#login-error').textContent = '';
  try {
    const data = await PortfolioAPI.request('/auth', { method: 'POST', body: { password: $('#admin-password').value } });
    if (!data.token) throw new Error('O servidor não retornou uma sessão válida.');
    $('#admin-password').value = ''; showStudio(data.token);
  } catch (error) { $('#login-error').textContent = error.status === 401 ? 'Senha incorreta.' : error.message; }
  finally { button.disabled = false; }
});
(async function restoreSession() {
  const token = getStoredToken();
  if (!token) return;
  try { await PortfolioAPI.request('/auth/check', { token }); showStudio(token); }
  catch (error) { if (error.status === 401) logout(); else $('#login-error').textContent = 'Não foi possível verificar a sessão. Entre novamente.'; }
})();
$('.tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]'); if (!button) return;
  if (document.querySelector('[data-dirty="true"]') && !confirm('Há alterações não salvas. Deseja trocar de categoria e descartá-las?')) return;
  studio.tab = button.dataset.tab;
  $('.tabs').querySelectorAll('button').forEach(tab => tab.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'page'); loadSection();
});
async function loadSection() {
  const tab = studio.tab, seq = ++studio.loading, section = sections[tab];
  $('#section-title').textContent = section.title; $('#section-description').textContent = section.description; $('#add-item').textContent = section.add;
  $('#admin-search').value = ''; $('#admin-no-results').hidden = true; $('#admin-count').textContent = '';
  $('#editor-list').innerHTML = '<div class="state">Carregando projetos…</div>'; notice('');
  try {
    let items;
    if (tab === 'music') {
      const [playlist, manual] = await Promise.all([request('/?admin=true'), request('/api/manual-music?admin=true')]);
      const merged = new Map();
      for (const item of playlist) merged.set(item.id, { ...item, manual: false });
      for (const item of manual) merged.set(item.id, { ...item, manual: true });
      items = [...merged.values()];
    } else items = await request(section.endpoint + '?admin=true');
    if (!Array.isArray(items)) throw new Error('O servidor retornou uma lista inválida.');
    if (tab === 'games') {
      items = await Promise.all(items.map(async game => {
        const id = encodeURIComponent(game.appId);
        const [tags, credits] = await Promise.all([request('/api/games/tags?id=' + id), request('/api/game/credits?id=' + id)]);
        return { ...game, tags: tags.tags || [], ...credits };
      }));
    }
    if (seq !== studio.loading) return;
    studio.records = items; renderRecords();
  } catch (error) {
    if (seq !== studio.loading) return;
    studio.records = [];
    $('#editor-list').innerHTML = '<div class="state"></div>';
    const state = $('#editor-list .state');
    state.textContent = tab === 'banners' && error.status === 404 ? 'O serviço de banners está indisponível. Tente novamente mais tarde.' : error.message;
    const retry = document.createElement('button'); retry.textContent = 'Tentar novamente'; retry.addEventListener('click', loadSection); state.append(retry);
  }
}
function field(name, title, value = '', type = 'text', extra = '') {
  return '<label>' + esc(title) + '<input name="' + name + '" type="' + type + '" value="' + esc(value) + '" ' + extra + '></label>';
}
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
function imageField(name, title, value = '', purpose, type = 'url', extra = '') {
  return '<div class="media-field">' + field(name, title, value, type, extra) + '<label class="upload-control">Enviar imagem<input type="file" accept="' + imageAccept + '" data-upload-field="' + esc(name) + '" data-upload-purpose="' + esc(purpose) + '"></label><p class="upload-status" data-upload-status="' + esc(name) + '" role="status" aria-live="polite"></p></div>';
}
function area(name, title, value = '', rows = 3) { return '<label>' + esc(title) + '<textarea name="' + name + '" rows="' + rows + '">' + esc(value) + '</textarea></label>'; }
function check(name, title, checked = false) { return '<label class="check-label"><input type="checkbox" name="' + name + '" ' + (checked ? 'checked' : '') + '>' + esc(title) + '</label>'; }
function tagField(record) { return field('tags', 'Tags (separadas por vírgula)', (record.tags || []).map(t => t.name || t).join(', ')); }
function bannerPreview(record) {
  const url = safeURL(record.image);
  return '<div class="banner-preview">' + (url ? '<img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer">' : '') + '<div><small>PRÉVIA DO BANNER</small><h3>' + esc(record.title || 'Título do banner') + '</h3><p>' + esc(record.subtitle || 'Texto de apoio') + '</p><span>' + esc(record.label || 'Conhecer projeto') + ' ↗</span></div></div>';
}
function episodeInput(name, title, value = '', type = 'text', extra = '') {
  return '<label>' + esc(title) + '<input data-episode-field="' + name + '" type="' + type + '" value="' + esc(value) + '" ' + extra + '></label>';
}
function episodeEditor(episode = {}) {
  return '<div class="episode-editor">' + episodeInput('id','',episode.id || '', 'hidden') + '<div class="row">' + episodeInput('title','Título',episode.title || '', 'text', 'required') + '</div>' +
    '<div class="row">' + episodeInput('url','URL do vídeo',episode.url || '', 'url', 'required') + '<div class="media-field">' + episodeInput('thumbnail','Miniatura (URL)',episode.thumbnail || '', 'url') + '<label class="upload-control">Enviar imagem<input type="file" accept="' + imageAccept + '" data-upload-field="thumbnail" data-upload-purpose="audiovisual-episode-thumbnail" data-upload-context="episode"></label><p class="upload-status" data-upload-status="thumbnail" role="status" aria-live="polite"></p></div></div>' +
    episodeInput('description','Descrição',episode.description || '') + '<div class="row">' + episodeInput('viewCount','Visualizações',episode.viewCount ?? 0, 'number', 'min="0" step="1"') + episodeInput('publishedAt','Publicado em',episode.publishedAt || '') + episodeInput('order','Ordem',episode.order ?? 0, 'number', 'min="0" step="1"') + '</div>' +
    '<label class="check-label"><input type="checkbox" data-episode-field="published" ' + (episode.published !== false ? 'checked' : '') + '>Publicado</label><button type="button" class="danger" data-remove-episode>Remover episódio</button></div>';
}
function episodesEditor(record) {
  const episodes = Array.isArray(record.episodes) ? record.episodes : [];
  return '<section class="series-fields"' + (record.format === 'series' ? '' : ' hidden') + '><p class="form-section">EPISÓDIOS DA SÉRIE</p><div class="episodes-list">' + episodes.map(episodeEditor).join('') + '</div><button type="button" data-add-episode>+ Adicionar episódio</button><p class="help">Cada episódio precisa de título e URL. Episódios ficam salvos junto com a obra.</p></section>';
}
function syncFormatUI(form) {
  const format = form.elements.format?.value || 'short-film';
  const seriesFields = form.querySelector('.series-fields');
  if (seriesFields) {
    seriesFields.hidden = format !== 'series';
    seriesFields.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = format !== 'series'; });
  }
  if (form.elements.url) {
    form.elements.url.required = format === 'short-film' && Boolean(form.elements.published?.checked);
    const urlLabel = form.elements.url.closest('label');
    if (urlLabel) urlLabel.hidden = format === 'series';
  }
}
function renderRecords() {
  const section = sections[studio.tab];
  $('#admin-count').textContent = studio.records.length + (studio.records.length === 1 ? ' item' : ' itens');
  $('#editor-list').innerHTML = '';
  if (!studio.records.length) { $('#editor-list').innerHTML = '<div class="state">Nenhum item por aqui ainda. Use o botão acima para começar.</div>'; return; }
  studio.records.forEach((record, index) => {
    const article = document.createElement('article'); article.className = 'editor-card'; article.dataset.search = [record.name,record.title,record.appId,record.id].filter(Boolean).join(' ').toLowerCase();
    let fields = '', preview = '';
    if (studio.tab === 'games') {
      const image = safeURL(record.cover) || (/^\d+$/.test(record.appId) ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + record.appId + '/header.jpg' : '');
      if (image) preview = '<img class="card-thumbnail" src="' + esc(image) + '" alt="" loading="lazy">';
      fields = '<div class="row">' + field('appId','Steam App ID',record.appId,'text','required pattern="[0-9]+" '+(record._new?'':'readonly')) + field('name','Nome do jogo',record.name,'text','required maxlength="200"') + '</div>';
      fields += '<div class="row">' + field('role','Seu papel',record.role) + field('dev','Desenvolvedora',record.dev) + '</div>';
      fields += field('note','Nota ou estado do projeto',record.note) + imageField('cover','Capa horizontal (URL)',record.cover,'game-cover') + imageField('poster','Pôster opcional (URL)',record.poster,'game-poster') + '<p class="help">A capa horizontal da Steam é a opção principal. O pôster vertical é opcional para usos alternativos.</p>';
      fields += check('featured','Priorizar este jogo na galeria',record.featured) + '<details class="editor-details"><summary>Descrição, idiomas e créditos</summary>' + area('description','Descrição',record.description);
      fields += '<div class="row">' + field('originalLanguage','Idioma original',record.originalLanguage || 'English') + field('releaseDate','Lançamento',record.releaseDate) + '</div>' + tagField(record);
      fields += '<p class="form-section">CRÉDITOS & PROVA DE TRABALHO</p>' + area('creditsChips','Um crédito por linha: Nome | Papel',(record.creditsChips || []).map(c => c.name + ' | ' + (c.role || '')).join('\n')) + imageField('creditsImage','Imagem dos créditos (URL)',record.creditsImage,'game-credits') + '</details>';
    } else if (studio.tab === 'banners') {
      preview = bannerPreview(record);
      fields = field('title','Título',record.title,'text','required maxlength="140"') + area('subtitle','Texto de apoio',record.subtitle,2) + imageField('image','Imagem do banner (URL)',record.image,'banner','url','required') + '<div class="row">' + field('href','Destino (URL ou /games)',record.href || '/games','text','required') + field('label','Texto do botão',record.label || 'Conhecer projeto') + '</div>' + field('order','Ordem (menor aparece primeiro)',record.order || 0,'number','min="0" step="1"') + check('enabled','Publicado no site',record.enabled !== false);
    } else if (studio.tab === 'music') {
      const image = safeURL(record.thumbnail);
      if (image) preview = '<img class="card-thumbnail" src="' + esc(image) + '" alt="" loading="lazy">';
      fields = tagField(record) + area('lyrics','Letra / Tradução',record.lyrics,7);
    } else {
      const image = safeURL(record.poster) || safeURL(record.cover) || safeURL(record.thumbnail);
      if (image) preview = '<img class="card-thumbnail" src="' + esc(image) + '" alt="" loading="lazy">';
      fields = field('title','Título',record.title,'text','required') + '<div class="row"><label>Formato<select name="format"><option value="short-film" '+(record.format !== 'series' ? 'selected' : '')+'>Curta-metragem</option><option value="series" '+(record.format === 'series' ? 'selected' : '')+'>Série</option></select></label>' + field('url','URL do vídeo',record.url,'url') + '</div><div class="row">' + field('type','Tipo de projeto',record.type) + '<label>Plataforma<select name="provider">' + ['youtube','vimeo','other'].map(p=>'<option '+(record.provider===p?'selected':'')+' value="'+p+'">'+p+'</option>').join('') + '</select></label></div>';
      fields += '<div class="row">' + imageField('cover','Capa horizontal (URL)',record.cover,'audiovisual-cover') + imageField('poster','Pôster opcional (URL)',record.poster,'audiovisual-poster') + '</div><p class="help">A capa horizontal é usada como padrão; o pôster é opcional.</p>';
      fields += imageField('thumbnail','Miniatura do vídeo (URL)',record.thumbnail,'audiovisual-thumbnail') + '<div class="row">' + field('role','Seu papel',record.role) + field('client','Cliente',record.client) + field('year','Ano',record.year) + field('duration','Duração',record.duration) + '</div>' + area('description','Descrição',record.description) + tagField(record) + field('order','Ordem',record.order || 0,'number','step="1"') + check('published','Publicado',record.published !== false) + check('featured','Destaque',record.featured) + check('showcase','Showcase (vídeo sem crédito)',record.showcase === true) + '<p class="help">Exibe este vídeo em uma seção discreta no fim dos audiovisuais, separado dos trabalhos creditados.</p>' + episodesEditor(record);
    }
    article.innerHTML = preview + '<form data-index="' + index + '"><h3>' + esc(record.name || record.title || 'Novo ' + (studio.tab === 'games' ? 'jogo' : studio.tab === 'audiovisuals' ? 'audiovisual' : 'banner')) + '</h3>' + fields + '<div class="form-actions"><button type="submit">Salvar alterações</button>' + ((studio.tab !== 'music' || record.manual) ? '<button type="button" class="danger" data-delete>Excluir</button>' : '') + '</div><p class="status" role="status"></p></form>';
    $('#editor-list').append(article);
    if (studio.tab === 'audiovisuals') syncFormatUI(article.querySelector('form'));
  });
}
$('#editor-list').addEventListener('input', event => {
  const form = event.target.closest('form'); if (!form) return; form.dataset.dirty = 'true';
  if (studio.tab === 'banners') {
    const record = Object.fromEntries(new FormData(form));
    const preview = form.closest('article').querySelector('.banner-preview');
    const wrapper = document.createElement('div'); wrapper.innerHTML = bannerPreview(record); preview.replaceWith(wrapper.firstElementChild);
  } else if (event.target.dataset.episodeField === 'thumbnail') {
    const url = safeURL(event.target.value), editor = event.target.closest('.episode-editor');
    let preview = editor?.querySelector('.episode-upload-preview');
    if (url && editor) {
      if (!preview) { preview = document.createElement('img'); preview.className = 'episode-upload-preview'; preview.alt = ''; preview.loading = 'lazy'; editor.append(preview); }
      preview.src = url; preview.hidden = false;
    } else if (preview) preview.hidden = true;
  } else if (['cover', 'poster', 'thumbnail', 'creditsImage'].includes(event.target.name)) {
    const url = safeURL(event.target.value), article = form.closest('article');
    let preview = article?.querySelector('.card-thumbnail');
    if (url && article) {
      if (!preview) { preview = document.createElement('img'); preview.className = 'card-thumbnail'; preview.alt = ''; preview.loading = 'lazy'; article.insertBefore(preview, form); }
      preview.src = url; preview.hidden = false;
    } else if (preview) preview.hidden = true;
  }
});
$('#editor-list').addEventListener('change', event => {
  const form = event.target.closest('form'); if (!form || studio.tab !== 'audiovisuals') return;
  if (event.target.name === 'format' && event.target.value === 'series') {
      const record = studio.records[Number(form.dataset.index)];
    const list = form.querySelector('.episodes-list');
    if ((form.elements.url?.value || record?.url) && list && !list.querySelector('.episode-editor')) {
      list.insertAdjacentHTML('beforeend', episodeEditor({ title: form.elements.title?.value || record.title, url: form.elements.url?.value || record.url, thumbnail: form.elements.thumbnail?.value || record.thumbnail, description: form.elements.description?.value || record.description, viewCount: Number(form.elements.viewCount?.value || record.viewCount || 0), publishedAt: form.elements.publishedAt?.value || record.publishedAt, order: 0, published: true }));
    }
  }
  if (event.target.name === 'format' || event.target.name === 'published') syncFormatUI(form);
});
$('#editor-list').addEventListener('click', event => {
  const add = event.target.closest('[data-add-episode]');
  if (add) {
    const list = add.closest('.series-fields').querySelector('.episodes-list');
    list.insertAdjacentHTML('beforeend', episodeEditor({ published: true, order: list.children.length }));
    const form = add.closest('form'); form.dataset.dirty = 'true'; syncFormatUI(form);
    return;
  }
  const remove = event.target.closest('[data-remove-episode]');
  if (remove) { const form = remove.closest('form'); remove.closest('.episode-editor').remove(); form.dataset.dirty = 'true'; }
});
function readFields(form) {
  const data = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type=checkbox][name]').forEach(input => data[input.name] = input.checked);
  if ('order' in data) data.order = Number(data.order) || 0;
  if (form.elements.format) {
    data.format = form.elements.format.value === 'series' ? 'series' : 'short-film';
    data.episodes = [...form.querySelectorAll('.episode-editor')].map(editor => {
      const episode = {};
      editor.querySelectorAll('[data-episode-field]').forEach(input => {
        const name = input.dataset.episodeField;
        episode[name] = input.type === 'checkbox' ? input.checked : input.value;
      });
      for (const name of ['viewCount', 'order']) episode[name] = Number(episode[name] || 0);
      return episode;
    });
  }
  for (const name of ['image','cover','poster','thumbnail','creditsImage','url']) {
    if (data[name] && !safeURL(data[name])) throw new Error('Use uma URL HTTP ou HTTPS válida no campo ' + name + '.');
  }
  if (data.href && !safeURL(data.href, true)) throw new Error('Informe um destino válido para o banner.');
  return data;
}
async function uploadImage(input) {
  const form = input.closest('form');
  if (!form || input.dataset.uploading === 'true' || !input.files?.length) return;
  const file = input.files[0];
  const fieldName = input.dataset.uploadField;
  const context = input.dataset.uploadContext || '';
  const target = context === 'episode'
    ? input.closest('.episode-editor')?.querySelector('[data-episode-field="' + CSS.escape(fieldName) + '"]')
    : form.elements[fieldName];
  const status = input.closest('.media-field')?.querySelector('[data-upload-status]');
  const saveButtons = form.querySelectorAll('button[type="submit"]');
  input.dataset.uploading = 'true'; input.disabled = true; saveButtons.forEach(button => { button.disabled = true; });
  if (status) { status.classList.remove('error'); status.textContent = 'Enviando…'; }
  try {
    const result = await PortfolioAPI.upload('/api/uploads/images', file, input.dataset.uploadPurpose, studio.token);
    const url = safeURL(result?.url);
    if (!url) throw new Error('O servidor não retornou uma URL de imagem válida.');
    if (!form.isConnected || (context === 'episode' && !input.closest('.episode-editor')?.isConnected)) return;
    if (!target) throw new Error('Não foi possível localizar o campo de imagem.');
    target.value = url;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    if (status) status.textContent = 'Imagem enviada. Salve o item para aplicar.';
  } catch (error) {
    if (status) { status.classList.add('error'); status.textContent = error.message || 'Não foi possível enviar a imagem.'; }
  } finally {
    input.value = '';
    input.disabled = false;
    delete input.dataset.uploading;
    if (form.isConnected && !form.querySelector('[data-uploading="true"]')) saveButtons.forEach(button => { button.disabled = false; });
  }
}
$('#editor-list').addEventListener('change', event => {
  const input = event.target.closest('input[type="file"][data-upload-field]');
  if (input) uploadImage(input);
});
async function saveTags(type, id, original, value) {
  const nextNames = [...new Set((value || '').split(',').map(name => name.trim()).filter(Boolean))];
  if (nextNames.some(name => name.length > 80)) throw new Error('Cada tag pode ter no máximo 80 caracteres.');
  const old = (original || []).map(tag => typeof tag === 'string' ? { name: tag } : tag);
  const endpoint = '/api/' + (type === 'games' ? 'games' : type === 'music' ? 'music' : 'audiovisuals') + '/tags';
  // Add before removing: a failed POST must not delete the existing metadata.
  for (const name of nextNames) {
    if (!old.some(tag => tag.name === name)) await request(endpoint, { method: 'POST', body: { id, tag: { name, color: '#6b7194' } } });
  }
  for (const tag of old) {
    if (!nextNames.includes(tag.name)) await request(endpoint + '?id=' + encodeURIComponent(id) + '&tag=' + encodeURIComponent(tag.name), { method: 'DELETE' });
  }
  return nextNames.map(name => old.find(tag => tag.name === name) || { name, color: '#6b7194' });
}
$('#editor-list').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, index = Number(form.dataset.index), record = studio.records[index];
  if (!record) return;
  const type = studio.tab, section = sections[type], status = form.querySelector('.status');
  if (form.querySelector('[data-uploading="true"]')) { status.textContent = 'Aguarde o envio da imagem terminar antes de salvar.'; return; }
  const buttons = form.querySelectorAll('button'); buttons.forEach(b=>b.disabled=true); status.classList.remove('error'); status.textContent = 'Salvando…';
  try {
    const values = readFields(form); let saved;
    if (type === 'music') {
      await request('/api/music/lyrics', { method: 'POST', body: { id: record.id, lyrics: values.lyrics } });
      const tags = await saveTags(type, record.id, record.tags, values.tags); saved = { ...record, lyrics: values.lyrics, tags };
    } else {
      const body = { ...record, ...values }; delete body._new; delete body.tags; delete body.creditsChips; delete body.creditsImage;
      if (type === 'banners' && !body.id) body.id = crypto.randomUUID();
      const response = await request(section.endpoint, { method: 'POST', body });
      saved = { ...record, ...values, ...body, ...(response && typeof response === 'object' ? response : {}), _new: false };
      if (type === 'games') {
        const creditsChips = values.creditsChips.split('\n').filter(s=>s.trim()).map(line=>{const [name,...role]=line.split('|');return {name:name.trim(),role:role.join('|').trim()};});
        const creditsImage = values.creditsImage || '';
        await request('/api/game/credits', { method: 'POST', body: { id: values.appId, creditsChips, creditsImage } });
        saved.creditsChips = creditsChips; saved.creditsImage = creditsImage;
      }
      if (type !== 'banners') saved.tags = await saveTags(type, body[section.key], record.tags, values.tags);
      if (type === 'audiovisuals' && Array.isArray(saved.episodes)) {
        form.querySelectorAll('.episode-editor').forEach((editor, episodeIndex) => {
          const idInput = editor.querySelector('[data-episode-field="id"]');
          if (idInput && saved.episodes[episodeIndex]) idInput.value = saved.episodes[episodeIndex].id;
        });
      }
    }
    studio.records[index] = saved; form.dataset.dirty = 'false';
    form.closest('article').dataset.search = [saved.name,saved.title,saved.appId,saved.id].filter(Boolean).join(' ').toLowerCase();
    form.querySelector('h3').textContent = saved.name || saved.title; status.textContent = 'Salvo. O cache público foi invalidado.';
    if (type === 'games') form.elements.appId.readOnly = true;
  } catch (error) { status.classList.add('error'); status.textContent = 'As alterações podem ter sido salvas parcialmente. ' + error.message + ' Revise e tente novamente.'; }
  finally { buttons.forEach(b=>b.disabled=false); }
});
$('#editor-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete]'); if (!button) return;
  const form = button.closest('form'), record = studio.records[Number(form.dataset.index)], section = sections[studio.tab];
  if (document.querySelector('[data-dirty="true"]') && !confirm('A exclusão recarrega a lista e descarta alterações ainda não salvas. Deseja continuar?')) return;
  if (!confirm('Excluir “' + (record.name || record.title || 'este item') + '”?')) return;
  if (record._new) { studio.records.splice(Number(form.dataset.index),1); renderRecords(); return; }
  button.disabled = true;
  try { await request(section.endpoint + '?' + section.key + '=' + encodeURIComponent(record[section.key]), { method: 'DELETE' }); await loadSection(); }
  catch (error) { const status = form.querySelector('.status'); status.classList.add('error'); status.textContent = error.message; button.disabled=false; }
});
$('#add-item').addEventListener('click', () => {
  if (document.querySelector('[data-dirty="true"]') && !confirm('Há alterações não salvas. Deseja descartá-las para criar um item?')) return;
  if (studio.tab === 'music') { $('#import-form').reset(); $('#import-dialog .status').textContent=''; $('#import-dialog').showModal(); return; }
  if (studio.tab === 'audiovisuals') studio.records.unshift({ _new:true, id: crypto.randomUUID(), title:'', format:'short-film', episodes:[], published:false, showcase:false, featured:false, order:0 });
  else studio.records.unshift(studio.tab === 'games' ? { _new:true, appId:'', name:'', tags:[], creditsChips:[] } : { _new:true, title:'', enabled:false, order:0 });
  renderRecords(); $('#editor-list form input').focus();
});
$('.dialog-close').addEventListener('click', ()=>$('#import-dialog').close());
$('#import-form').addEventListener('submit', async event => {
  event.preventDefault(); const form=event.target, button=form.querySelector('[type=submit]'), status=form.querySelector('.status');button.disabled=true;status.textContent='Buscando informações…';
  try {
    const url = $('#video-url').value.trim();
    const info = await request('/api/fetch-video-info?url=' + encodeURIComponent(url));
    const body = { ...info, url };
    if (studio.tab === 'audiovisuals') { delete body.id; Object.assign(body, { provider:'youtube',published:true,featured:false,order:0 }); }
    await request(sections[studio.tab].endpoint,{method:'POST',body});$('#import-dialog').close();await loadSection();
  } catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
$('#refresh').addEventListener('click',async event=>{
  if (document.querySelector('[data-dirty="true"]') && !confirm('Há alterações não salvas. Deseja descartá-las para atualizar?')) return;
  const button=event.target;button.disabled=true;notice('');
  try{await request('/refresh',{method:'POST'});PortfolioAPI.clear();await loadSection();notice('Cache atualizado. As próximas visitas buscarão os dados atuais.');}
  catch(error){notice(error.message);}finally{button.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(document.querySelector('[data-dirty="true"]')){event.preventDefault();event.returnValue='';}});

$('#admin-search').addEventListener('input', event => {
  const query = event.target.value.toLowerCase().trim();
  let visible = 0;
  $('#editor-list').querySelectorAll('.editor-card').forEach(card => { card.hidden = !card.dataset.search.includes(query); if (!card.hidden) visible++; });
  $('#admin-no-results').hidden = visible > 0 || !studio.records.length;
  $('#admin-count').textContent = visible + ' de ' + studio.records.length + ' itens';
});

$('#editor-list').addEventListener('error', event => {
  if (event.target.matches('img')) event.target.hidden = true;
}, true);
