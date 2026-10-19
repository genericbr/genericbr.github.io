/* Public portfolio: data, presentation and accessible routes. */
(function () {
  'use strict';
  const cfg = typeof CONFIG === 'undefined' ? {} : CONFIG;
  const state = { games: [], music: [], audiovisuals: [], banners: [], category: 'games', query: '', sort: 'newest', sources: new Map(), failures: [], loaded: false };
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function safeUrl(value, { mail = false } = {}) {
    if (!value) return '';
    try {
      const url = new URL(String(value), location.origin);
      return ['https:', 'http:', ...(mail ? ['mailto:'] : [])].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }
  const paths = {
    portfolio: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    audiovisuals: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/>',
    about: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    gamepad: '<path d="M6 8h12l3 9c.5 2-1 3-2.5 2l-3-3h-7l-3 3C4 20 2.5 19 3 17zM7 10v4M5 12h4"/><circle cx="16" cy="11" r=".5"/><circle cx="18" cy="13" r=".5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 3-3 6 6"/>'
  };
  const logos = {
    youtube: '<path d="M23.5 6.19a3 3 0 0 0-2.12-2.12C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.57A3 3 0 0 0 .5 6.19 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.81 3 3 0 0 0 2.12 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.57a3 3 0 0 0 2.12-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/>',
    discord: '<path d="M20.3 4.4A19.2 19.2 0 0 0 15.6 3c-.2.4-.5.9-.6 1.3a17.8 17.8 0 0 0-5.9 0A13 13 0 0 0 8.4 3 19.4 19.4 0 0 0 3.7 4.4 20.3 20.3 0 0 0 .5 18.7a19.4 19.4 0 0 0 5.9 3 14 14 0 0 0 1.2-2 12.7 12.7 0 0 1-2-.9l.5-.4a13.8 13.8 0 0 0 11.8 0l.5.4a12.7 12.7 0 0 1-2 1 14 14 0 0 0 1.2 2 19.3 19.3 0 0 0 5.9-3A20.2 20.2 0 0 0 20.3 4.4zM8.2 15.3c-1.3 0-2.3-1.2-2.3-2.6s1-2.6 2.3-2.6c1.3 0 2.3 1.2 2.3 2.6s-1 2.6-2.3 2.6zm7.6 0c-1.3 0-2.3-1.2-2.3-2.6s1-2.6 2.3-2.6c1.3 0 2.3 1.2 2.3 2.6s-1 2.6-2.3 2.6z"/>'
  };
  function icon(name) {
    if (name === 'games') return '<span class="steam-icon">' + icon('gamepad') + '<img src="/images/steam-icon.png" alt="" aria-hidden="true"></span>';
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ' + (logos[name] ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"') + '>' + (logos[name] || paths[name] || paths.image) + '</svg>';
  }
  function date(value) {
    const parsed = new Date(value);
    return value && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short' }).format(parsed) : '';
  }
  function gameImage(game) {
    return safeUrl(game.cover || (/^\d+$/.test(String(game.appId)) ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + game.appId + '/header.jpg' : '') || game.poster);
  }
  function media(image, title) {
    return '<div class="media-fallback" aria-hidden="true">' + icon('image') + '</div>' + (image ? '<img src="' + esc(image) + '" alt="' + esc(title) + '" loading="lazy" decoding="async">' : '');
  }
  function bindImages(root) {
    root.querySelectorAll('img').forEach(img => {
      const failed = () => { img.hidden = true; img.closest('.poster-media,.work-media')?.classList.add('image-unavailable'); };
      img.addEventListener('error', failed, { once: true });
      if (img.complete && img.naturalWidth === 0) failed();
    });
  }
  function normalize(video, type) {
    const item = { ...video, __type: type, id: String(video.id || video.videoId || ''), title: video.title || 'Untitled project', viewCount: Number(video.viewCount) || 0 };
    if (type === 'audiovisuals') {
      item.format = video.format === 'series' ? 'series' : 'short-film';
      item.episodes = (Array.isArray(video.episodes) ? video.episodes : []).filter(episode => episode.published !== false && episode.status !== 'draft').map(episode => ({ ...episode, id: String(episode.id), viewCount: Math.max(0, Number(episode.viewCount) || 0) })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      if (item.format === 'series') item.viewCount = item.episodes.reduce((sum, episode) => sum + episode.viewCount, 0);
    }
    return item;
  }
  const workFormat = item => item.format === 'series' ? 'Series' : 'Short film';
  function card(item, index, poster) {
    if (item.__type === 'games') {
      return '<a class="game-card" href="/game/' + encodeURIComponent(item.appId) + '" data-route><div class="work-media game-media">' + media(gameImage(item), item.name) + '<span class="poster-badge">Steam</span></div><div class="game-card-info"><h2 class="card-title">' + esc(item.name) + '</h2><p class="game-card-role">' + esc(item.role || 'PT-BR Localization') + '</p>' + (item.dev ? '<p class="card-meta">' + esc(item.dev) + '</p>' : '') + '<div class="game-card-footer">' + (item.note ? '<span class="game-note">' + esc(item.note) + '</span>' : '<span></span>') + '<span class="game-card-open" aria-hidden="true">View project ↗</span></div></div></a>';
    }
    const image = safeUrl((poster && item.poster) || item.cover || item.thumbnail || item.poster);
    const path = item.__type === 'audiovisuals' ? 'audiovisual' : 'video';
    const meta = [item.__type === 'audiovisuals' ? workFormat(item) : '', item.format === 'series' ? item.episodes.length + ' episode' + (item.episodes.length === 1 ? '' : 's') : '', item.channelTitle || item.client, date(item.publishedAt) || item.year].filter(Boolean).join(' · ');
    return '<a class="' + (poster ? 'poster-card' : 'work-card') + '" href="/' + path + '/' + encodeURIComponent(item.id) + '" data-route><div class="' + (poster ? 'poster-media' : 'work-media') + '">' + media(image, item.title) + '<span class="poster-badge">' + (item.__type === 'music' ? 'Music' : item.showcase ? 'Showcase' : workFormat(item)) + '</span><span class="poster-index">' + String(index + 1).padStart(2, '0') + '</span><span class="card-open" aria-hidden="true">↗</span></div><div class="card-info"><h2 class="card-title">' + esc(item.title) + '</h2><p class="card-meta">' + esc(meta) + '</p><p class="video-views">' + formatNumber(item.viewCount) + ' views</p></div></a>';
  }
  const categoryInfo = {
    games: { title: 'Steam Games', noun: 'game' },
    music: { title: 'Music', noun: 'song' },
    audiovisuals: { title: 'Audiovisuals', noun: 'work' }
  };
  const formatNumber = value => Number(value || 0).toLocaleString('en-US');
  const totalViews = list => list.reduce((sum, item) => sum + Math.max(0, Number(item.viewCount) || 0), 0);
  function updateSummary() {
    const counts = Object.fromEntries(Object.keys(categoryInfo).map(key => [key, state[key].filter(item => key !== 'audiovisuals' || !item.showcase).length]));
    const parts = Object.keys(categoryInfo).filter(key => counts[key]).map(key => '<strong>' + formatNumber(counts[key]) + '</strong> ' + categoryInfo[key].noun + (counts[key] === 1 ? '' : 's'));
    byId('profile-stats').hidden = !parts.length;
    byId('profile-stats').innerHTML = parts.join(' · ');
    byId('home-total-views').textContent = state.failures.includes('music') && state.failures.includes('audiovisuals') && !state.music.length && !state.audiovisuals.length ? '—' : formatNumber(totalViews(state.music) + totalViews(state.audiovisuals));
    byId('profile-views').hidden = !state.loaded && !state.music.length && !state.audiovisuals.length;
    byId('profile-views').title = state.failures.includes('music') || state.failures.includes('audiovisuals') ? 'Only views from currently available projects are included.' : 'Combined views across music and audiovisual projects.';
    byId('about-song-count').textContent = formatNumber(state.music.length);
    byId('about-total-views').textContent = formatNumber(totalViews(state.music));
  }
  function renderCollection() {
    const category = state.category, info = categoryInfo[category];
    let list = state[category].map(item => category === 'games' ? { ...item, __type: 'games', title: item.name } : item);
    if (state.query) list = list.filter(item => [item.title, item.dev, item.channelTitle, item.client, item.role, ...(item.episodes || []).map(episode => episode.title)].some(value => String(value || '').toLowerCase().includes(state.query)));
    if (state.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === 'views') list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else list.sort((a, b) => category === 'games' && Boolean(a.featured) !== Boolean(b.featured) ? Number(Boolean(b.featured)) - Number(Boolean(a.featured)) : (Date.parse(b.publishedAt || b.releaseDate) || 0) - (Date.parse(a.publishedAt || a.releaseDate) || 0));
    const showcases = category === 'audiovisuals' ? list.filter(item => item.showcase) : [];
    if (category === 'audiovisuals') list = list.filter(item => !item.showcase);
    byId('collection-title').textContent = info.title;
    byId('collection-icon').innerHTML = icon(category);
    byId('collection-count').textContent = list.length + ' ' + info.noun + (list.length === 1 ? '' : 's');
    const grid = byId('collection-grid');
    const posters = category !== 'music';
    grid.className = category === 'games' ? 'games-grid' : posters ? 'poster-grid audiovisuals-gallery' : 'work-grid';
    grid.innerHTML = list.map((item, index) => card(item, index, posters)).join('');
    const samples = byId('showcases');
    samples.hidden = !showcases.length;
    byId('showcase-count').textContent = String(showcases.length);
    const showcaseGrid = byId('showcase-grid');
    showcaseGrid.innerHTML = showcases.map((item, index) => card(item, index, false)).join('');
    if (state.query && showcases.length) samples.open = true;
    bindImages(showcaseGrid);
    byId('work-empty').hidden = Boolean(list.length || showcases.length);
    byId('work-empty').textContent = state.query ? 'No projects match your search.' : state.failures.includes(category) ? 'This collection could not be loaded. Please try again.' : 'No projects in this category yet.';
    const views = byId('collection-views');
    views.hidden = category === 'games';
    views.innerHTML = category === 'games' ? '' : '<strong>' + formatNumber(totalViews(state[category])) + '</strong> total views';
    document.querySelectorAll('[data-category]').forEach(anchor => { if (anchor.dataset.category === category) anchor.setAttribute('aria-current','page'); else anchor.removeAttribute('aria-current'); });
    bindImages(grid);
  }
  function setView(name) {
    document.querySelectorAll('.site-view').forEach(view => { view.hidden = view.id !== 'view-' + name; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function renderBanners() {
    const banners = state.banners.filter(banner => banner.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    byId('banners').hidden = !banners.length;
    byId('banner-grid').innerHTML = banners.map(banner => {
      const href = safeUrl(banner.href); const image = safeUrl(banner.image);
      return '<article class="banner-card">' + (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '') + '<div class="banner-content"><h3>' + esc(banner.title) + '</h3><p>' + esc(banner.subtitle) + '</p>' + (href ? '<a class="banner-link" href="' + esc(href) + '"' + (new URL(href).origin === location.origin ? ' data-route' : ' target="_blank" rel="noopener"') + '>' + esc(banner.label || 'Explore project') + ' ↗</a>' : '') + '</div></article>';
    }).join('');
  }
  function updateStatus() {
    const values = [...state.sources.values()];
    const stale = values.includes('stale');
    const notice = byId('data-notice');
    notice.hidden = !state.failures.length && !stale;
    notice.innerHTML = state.failures.length ? 'Some projects could not be loaded. Showing the available work. <button type="button" id="retry-data">Try again ↻</button>' : stale ? 'Showing a previously saved copy while the connection is unavailable.' : '';
    byId('retry-data')?.addEventListener('click', () => load(true));
  }
  window.addEventListener('portfolio:cache', event => {
    if (event.detail.state === 'invalidated') { load(true); return; }
    state.sources.set(event.detail.path, event.detail.state); updateStatus();
  });
  let loadingSequence = 0;
  async function load(force = false) {
    const sequence = ++loadingSequence;
    state.failures = []; state.sources.clear(); state.loaded = false;
    if (!state.games.length) state.games = (cfg.steam?.games || []).map(game => ({ ...game, appId: String(game.appId) }));
    updateSummary(); renderCollection();
    const jobs = [['games', '/api/games'], ['music', '/'], ['audiovisuals', '/api/audiovisuals/playlist'], ['banners', '/api/banners']];
    await Promise.allSettled(jobs.map(async ([type, path]) => {
      try {
        const records = await PortfolioAPI.get(path, { ttl: 300000, force });
        if (sequence !== loadingSequence) return;
        if (!Array.isArray(records)) throw new Error('Invalid project list');
        if (type === 'games') state.games = records.map(game => ({ ...game, appId: String(game.appId) }));
        else state[type] = type === 'banners' ? records : records.map(video => normalize(video, type));
      } catch (error) {
        if (sequence !== loadingSequence) return;
        if (type === 'banners' && error.status === 404) state.banners = Array.isArray(cfg.banners) ? cfg.banners : [];
        else { state.failures.push(type); console.warn('Portfolio: could not load ' + type, error.message); }
      }
      if (sequence === loadingSequence) { updateSummary(); renderCollection(); renderBanners(); updateStatus(); }
    }));
    if (sequence !== loadingSequence) return;
    state.loaded = true; updateSummary(); updateStatus(); handleRoute();
  }
  let detailSequence = 0;
  function closeDetail() {
    detailSequence++;
    byId('detail-container').replaceChildren();
  }
  function detailShell(title) {
    closeDetail();
    setView('detail');
    const panel = document.createElement('div'); panel.id = 'detail-dialog'; panel.className = 'project-detail-card';
    panel.innerHTML = '<div class="project-detail"><h2 id="detail-title">' + esc(title) + '</h2><p class="empty-state">Loading project…</p></div>';
    byId('detail-container').append(panel);
    const back = byId('detail-back');
    back.href = '/' + state.category;
    back.innerHTML = icon('left') + 'Back to ' + categoryInfo[state.category].title.toLowerCase();
    return panel;
  }
  function textFromHtml(value) { return new DOMParser().parseFromString(String(value || ''), 'text/html').body.textContent || ''; }
  function youtubeId(video) {
    if (!video.url && /^[A-Za-z0-9_-]{11}$/.test(video.id)) return video.id;
    try {
      const url = new URL(video.url); if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return '';
      const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop(); return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
    } catch { return ''; }
  }
  function videoPlayer(video) {
    const id = youtubeId(video), url = safeUrl(video.url);
    return id ? '<div class="detail-video"><iframe src="https://www.youtube.com/embed/' + id + '?rel=0&cc_lang_pref=pt" title="' + esc(video.title) + '" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' : url ? '<a class="button button-outline" href="' + esc(url) + '" target="_blank" rel="noopener">Open translation ↗</a>' : '';
  }
  async function showDetail(type, id, episodeId) {
    const items = type === 'games' ? state.games : state[type];
    const item = items.find(record => String(type === 'games' ? record.appId : record.id) === id);
    const dialog = detailShell(item?.name || item?.title || 'Project'); const sequence = detailSequence;
    const content = dialog.querySelector('.project-detail');
    if (!item) { content.innerHTML = '<h2 id="detail-title">Project not found</h2><p class="detail-description">' + (state.failures.includes(type) ? 'This collection is currently unavailable. Return to the category and try loading the projects again.' : 'This project may have been removed or is not published.') + '</p>'; return; }
    if (type === 'games') {
      const [steam, tags, credits] = await Promise.allSettled([
        PortfolioAPI.get('/api/steam/app?appids=' + encodeURIComponent(id), { ttl: 1800000 }),
        PortfolioAPI.get('/api/games/tags?id=' + encodeURIComponent(id)),
        PortfolioAPI.get('/api/game/credits?id=' + encodeURIComponent(id))
      ]);
      if (sequence !== detailSequence) return;
      const details = steam.status === 'fulfilled' ? steam.value : {};
      const proof = credits.status === 'fulfilled' ? credits.value : {};
      const images = [...new Set([safeUrl(item.cover) || safeUrl(details.headerImage) || gameImage(item), ...(details.screenshots || []).map(image => safeUrl(typeof image === 'string' ? image : image.full || image.thumbnail)), safeUrl(item.poster)].filter(Boolean))];
      const title = item.name || details.name;
      const developer = item.dev || details.developers?.join(', ');
      const release = item.releaseDate || details.releaseDate;
      const creditsMarkup = credits.status === 'rejected' ? '<p>Credits are currently unavailable.</p>' : (proof.creditsChips || []).length ? '<ul>' + proof.creditsChips.map(credit => '<li><strong>' + esc(credit.name) + '</strong> ' + esc(credit.role) + '</li>').join('') + '</ul>' : '';
      content.innerHTML = '<header class="game-detail-heading"><div><h2 id="detail-title">' + esc(title) + '</h2><p class="detail-role">' + esc(item.role || 'PT-BR Localization') + '</p></div>' + (item.note ? '<span class="game-note">' + esc(item.note) + '</span>' : '') + '</header><div class="game-detail-layout"><div class="game-visuals">' + (images.length ? '<div class="detail-gallery"><div class="gallery-stage"><div class="gallery-fallback" aria-hidden="true">' + icon('image') + '</div><a id="gallery-full" href="' + esc(images[0]) + '" target="_blank" rel="noopener" aria-label="View full image"><img id="gallery-image" src="' + esc(images[0]) + '" alt="' + esc(title) + '"></a></div>' + (images.length > 1 ? '<div class="gallery-controls"><button type="button" id="gallery-prev" aria-label="Previous screenshot">' + icon('left') + '</button><span id="gallery-count">1 / ' + images.length + '</span><button type="button" id="gallery-next" aria-label="Next screenshot">' + icon('right') + '</button></div>' : '') + '</div>' + (images.length > 1 ? '<div class="gallery-thumbnails" aria-label="Game images">' + images.map((image, index) => '<button type="button" data-gallery-index="' + index + '" aria-label="View image ' + (index + 1) + '"' + (index === 0 ? ' aria-current="true"' : '') + '><span>' + (index + 1) + '</span><img src="' + esc(image) + '" alt="" loading="lazy"></button>').join('') + '</div>' : '') : '') + '<div class="game-description"><h3>About the game</h3><p class="detail-description">' + esc(textFromHtml(item.description || details.description || 'No description provided.')) + '</p></div></div><aside class="game-facts"><h3>Project details</h3><dl>' + (developer ? '<div><dt>Studio</dt><dd>' + esc(developer) + '</dd></div>' : '') + (release ? '<div><dt>Release</dt><dd>' + esc(release) + '</dd></div>' : '') + '<div><dt>Localization</dt><dd>' + esc(item.originalLanguage || 'English') + ' → PT-BR</dd></div></dl>' + (tags.status === 'fulfilled' && tags.value.tags?.length ? '<div class="detail-tags">' + tags.value.tags.map(tag => '<span>' + esc(tag.name || tag) + '</span>').join('') + '</div>' : '') + '<a class="button button-outline" href="https://store.steampowered.com/app/' + encodeURIComponent(id) + '" target="_blank" rel="noopener">' + icon('games') + 'View on Steam</a></aside></div><details class="proof"><summary>Credits & proof of work</summary>' + creditsMarkup + (safeUrl(proof.creditsImage) ? '<a href="' + esc(safeUrl(proof.creditsImage)) + '" target="_blank" rel="noopener"><img src="' + esc(safeUrl(proof.creditsImage)) + '" alt="Game credits"></a>' : !proof.creditsChips?.length && credits.status === 'fulfilled' ? '<p>No credits provided yet.</p>' : '') + '</details>' + (steam.status === 'rejected' || tags.status === 'rejected' ? '<p class="detail-warning">Additional game information is temporarily unavailable.</p>' : '');
      bindImages(content);
      if (images.length > 1) {
        let current = 0;
        const select = index => {
          current = (index + images.length) % images.length;
          const image = byId('gallery-image'); image.hidden = false; image.src = images[current];
          image.onerror = () => { image.hidden = true; };
          byId('gallery-full').href = images[current];
          byId('gallery-count').textContent = (current + 1) + ' / ' + images.length;
          content.querySelectorAll('[data-gallery-index]').forEach(button => { if (Number(button.dataset.galleryIndex) === current) button.setAttribute('aria-current','true'); else button.removeAttribute('aria-current'); });
        };
        byId('gallery-prev').onclick = () => select(current - 1);
        byId('gallery-next').onclick = () => select(current + 1);
        content.querySelectorAll('[data-gallery-index]').forEach(button => { button.onclick = () => select(Number(button.dataset.galleryIndex)); });
      }
    } else if (type === 'audiovisuals' && item.format === 'series') {
      const episode = episodeId ? item.episodes.find(entry => entry.id === episodeId) : null;
      content.innerHTML = '<h2 id="detail-title">' + esc(item.title) + '</h2><p class="detail-role">Series' + (item.showcase ? ' · Showcase · Uncredited work' : '') + '</p><p class="card-meta">' + esc([item.client || item.channelTitle, item.role, item.year, formatNumber(item.viewCount) + ' total views'].filter(Boolean).join(' · ')) + '</p>' + (item.description ? '<p class="detail-description">' + esc(item.description) + '</p>' : '') + (episodeId && !episode ? '<p class="detail-warning">This episode is not available.</p>' : '') + (episode ? '<section class="episode-player" aria-labelledby="episode-title"><h3 id="episode-title">' + esc(episode.title) + '</h3>' + videoPlayer(episode) + (episode.description ? '<p class="detail-description">' + esc(episode.description) + '</p>' : '') + '</section>' : '') + '<section class="episode-section" aria-labelledby="episodes-heading"><h3 id="episodes-heading">Episodes <span>' + item.episodes.length + '</span></h3>' + (item.episodes.length ? '<ol class="episode-list">' + item.episodes.map((entry, index) => '<li><a class="episode-link" href="/audiovisual/' + encodeURIComponent(id) + '/' + encodeURIComponent(entry.id) + '" data-route' + (entry.id === episodeId ? ' aria-current="page"' : '') + '><span class="episode-number">' + String(index + 1).padStart(2, '0') + '</span><div><strong>' + esc(entry.title) + '</strong><small>' + esc([date(entry.publishedAt), formatNumber(entry.viewCount) + ' views'].filter(Boolean).join(' · ')) + '</small></div><span class="episode-play" aria-hidden="true">▶</span></a></li>').join('') + '</ol>' : '<p class="empty-state">No episodes published yet.</p>') + '</section>';
      if (episodeId) { byId('detail-back').href = '/audiovisual/' + encodeURIComponent(id); byId('detail-back').innerHTML = icon('left') + 'Back to ' + esc(item.title); }
    } else {
      content.innerHTML = '<h2 id="detail-title">' + esc(item.title) + '</h2>' + (type === 'audiovisuals' ? '<p class="detail-role">Short film' + (item.showcase ? ' · Showcase · Uncredited work' : '') + '</p>' : '') + '<p class="card-meta">' + esc([formatNumber(item.viewCount) + ' views', item.channelTitle || item.client, date(item.publishedAt) || item.year, item.role].filter(Boolean).join(' · ')) + '</p>' + videoPlayer(item) + '<p class="detail-description">' + esc(item.description || '') + '</p>' + (type === 'music' ? '<h3>Lyrics / Translation</h3><div id="lyrics-detail" class="detail-description" aria-live="polite">Loading lyrics…</div>' : '');
      if (type === 'music') {
        try { const result = await PortfolioAPI.get('/api/music/lyrics?id=' + encodeURIComponent(id), { ttl: 600000 }); if (sequence === detailSequence) byId('lyrics-detail').textContent = result.lyrics || 'No lyrics available yet.'; }
        catch { if (sequence === detailSequence) byId('lyrics-detail').textContent = 'Lyrics could not be loaded. Please reopen the project to retry.'; }
      }
    }
  }
  function handleRoute() {
    let path = location.pathname;
    const redirected = new URLSearchParams(location.search).get('path');
    if (redirected?.startsWith('/') && !redirected.startsWith('//')) { history.replaceState(null, '', redirected); path = location.pathname; }
    const raw = location.hash.replace(/^#\/?/, '') || path.replace(/^\/|\/$/g, '');
    let name, id, episodeId;
    try { [name, id, episodeId] = raw.split('/').map(decodeURIComponent); } catch { name = 'home'; }
    const types = { game: 'games', video: 'music', audiovisual: 'audiovisuals' };
    if (types[name] && id) {
      state.category = types[name];
      if (state.loaded) showDetail(types[name], id, episodeId);
      else detailShell('Loading project…');
      return;
    }
    closeDetail();
    if (categoryInfo[name]) {
      if (state.category !== name) { state.query = ''; byId('work-search').value = ''; byId('showcases').open = false; }
      state.category = name; renderCollection(); setView('collection');
    } else if (['portfolio', 'work'].includes(name)) { setView('portfolio'); }
    else if (name === 'about') { setView('about'); }
    else { setView('home'); }
  }
  function setup() {
    byId('footer-year').textContent = new Date().getFullYear();
    byId('about-name').textContent = cfg.name || 'GenericBR';
    byId('about-bio').textContent = cfg.bio || '';
    document.title = (cfg.name || 'GenericBR') + ' · EN → PT-BR Localizer';
    byId('profile-handle').textContent = cfg.handle || '';
    const avatar = byId('profile-avatar');
    avatar.innerHTML = '<span>' + esc((cfg.name || 'G').charAt(0)) + '</span>' + (safeUrl(cfg.avatar) ? '<img src="' + esc(safeUrl(cfg.avatar)) + '" alt="' + esc(cfg.name) + '">' : '');
    bindImages(avatar);
    document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
    const links = [];
    if (safeUrl(cfg.links?.youtube)) links.push('<a class="profile-chip" href="' + esc(safeUrl(cfg.links.youtube)) + '" target="_blank" rel="noopener">' + icon('youtube') + 'YouTube</a>');
    const contact = [];
    if (safeUrl(cfg.links?.discord)) contact.push('<a href="' + esc(safeUrl(cfg.links.discord)) + '" target="_blank" rel="noopener">' + icon('discord') + 'Discord</a>');
    if (cfg.links?.email) contact.push('<a id="contact-email" href="mailto:' + esc(cfg.links.email) + '">' + icon('mail') + 'Email</a>');
    if (contact.length) links.push('<details class="contact-menu"><summary class="profile-chip">' + icon('mail') + 'Contact</summary><div class="contact-links">' + contact.join('') + '</div></details>');
    links.push('<a class="profile-chip" href="/about" data-route>' + icon('about') + 'About</a>');
    byId('profile-links').innerHTML = links.join('');
    byId('about-heading').textContent = cfg.name || 'GenericBR';
    byId('about-tagline').textContent = cfg.tagline || '';
    byId('about-avatar').innerHTML = avatar.innerHTML;
    bindImages(byId('about-avatar'));
    byId('work-search').addEventListener('input', event => { state.query = event.target.value.toLowerCase().trim(); renderCollection(); });
    byId('work-sort').addEventListener('change', event => { state.sort = event.target.value; renderCollection(); });
    document.addEventListener('click', event => {
      const contactMenu = document.querySelector('.contact-menu[open]');
      if (contactMenu && !contactMenu.contains(event.target)) contactMenu.open = false;
      const anchor = event.target.closest('a');
      if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === '_blank') return;
      if (!anchor.hasAttribute('data-route')) return;
      const url = new URL(anchor.href); if (url.origin !== location.origin) return;
      event.preventDefault(); history.pushState(null, '', url.pathname + url.search + url.hash); handleRoute();
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelector('.contact-menu')?.removeAttribute('open');
      if (event.key === 'Escape' && !byId('view-detail').hidden) { history.pushState(null, '', '/' + state.category); handleRoute(); }
    });
    window.addEventListener('popstate', handleRoute); window.addEventListener('hashchange', handleRoute);
    handleRoute();
    load();
  }
  document.addEventListener('DOMContentLoaded', setup);
})();
