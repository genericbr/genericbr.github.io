(function () {
  'use strict';

  var cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
  var defaultTheme = { accent: '#f78b4a', background: '#0d0f18', surface: '#161927', card: '#1c1f30', text: '#e2e4ef', muted: '#999fb9' };
  var defaults = {
    profile: {
      name: cfg.name || 'GenericBR', handle: cfg.handle || 'Dhimitri Rael',
      tagline: cfg.tagline || 'English · Portuguese Translator', bio: cfg.bio || '',
      avatar: cfg.avatar || '', links: Object.assign({ youtube: '', discord: '', email: '', portfolio: '' }, cfg.links || {}),
      languages: { native: 'PT-BR', fluent: 'EN', learning: 'ES' }
    },
    about: { text: "Hi, I'm Dhimitri (GenericBR), a PT-BR translator and adapter based in Rio Grande do Norte, Brazil. I localize indie games and Vocaloid/indie music lyrics — always aiming for natural, emotionally faithful Portuguese.\n\nFor music, I work line-by-line from the original language, making sure the lyrics hit the same way in Portuguese; for games, I focus on the game's theme and character voice so the experience feels authentic, not translated.\n\nI aspire to learn Spanish to expand my translation reach.", showStats: true },
    theme: defaultTheme
  };
  var current = clone(defaults);
  var started = false;
  var requestPromise;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, fallback, max) { if (typeof value !== 'string') return fallback; return value.trim().slice(0, max || 2000); }
  function hex(value, fallback) { if (typeof value !== 'string' || !(/^#[0-9a-f]{3}$/i.test(value) || /^#[0-9a-f]{6}$/i.test(value))) return fallback; var color = value.toLowerCase(); return color.length === 4 ? '#' + color.slice(1).split('').map(function (part) { return part + part; }).join('') : color; }
  function url(value) { if (typeof value !== 'string' || !value.trim() || !/^https?:\/\//i.test(value) || /[\u0000-\u001f\s]/.test(value)) return ''; try { var parsed = new URL(value); if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return ''; return parsed.href.slice(0, 1000); } catch (error) { return ''; } }
  function email(value) { return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().slice(0, 320) : ''; }
  function merge(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var p = raw.profile || {}, links = p.links || {}, langs = p.languages || {}, a = raw.about || {}, t = raw.theme || {};
    return { profile: {
      name: text(p.name, defaults.profile.name, 120), handle: text(p.handle, defaults.profile.handle, 120), tagline: text(p.tagline, defaults.profile.tagline, 240), bio: text(p.bio, defaults.profile.bio, 2000), avatar: url(p.avatar),
      links: { youtube: url(links.youtube), discord: url(links.discord), email: email(links.email), portfolio: url(links.portfolio) },
      languages: { native: text(langs.native, defaults.profile.languages.native, 30), fluent: text(langs.fluent, defaults.profile.languages.fluent, 30), learning: text(langs.learning, defaults.profile.languages.learning, 30) }
    }, about: { text: text(a.text, defaults.about.text, 10000), showStats: a.showStats !== false }, theme: {
      accent: hex(t.accent, defaultTheme.accent), background: hex(t.background, defaultTheme.background), surface: hex(t.surface, defaultTheme.surface), card: hex(t.card, defaultTheme.card), text: hex(t.text, defaultTheme.text), muted: hex(t.muted, defaultTheme.muted)
    }};
  }
  function setAvatar(node, source, label) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
    if (url(source)) { var image = document.createElement('img'); image.src = source; image.alt = label || ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', function () { node.replaceChildren(); var fallback = document.createElement('span'); fallback.textContent = (label || 'G').charAt(0).toUpperCase(); node.appendChild(fallback); }, { once: true }); node.appendChild(image); }
    else { var fallback = document.createElement('span'); fallback.textContent = (label || 'G').charAt(0).toUpperCase(); node.appendChild(fallback); }
  }
  function applyToDocument(settings) {
    current = merge(settings || current);
    if (!document.getElementById('view-home')) return current;
    var profile = current.profile, byId = function (id) { return document.getElementById(id); };
    ['about-name', 'about-heading', 'footer-site-name'].forEach(function (id) { var node = byId(id); if (node) node.textContent = profile.name; });
    var handle = byId('profile-handle'); if (handle) handle.textContent = profile.handle;
    var bio = byId('about-bio'); if (bio) bio.textContent = profile.bio;
    var tagline = byId('about-tagline'); if (tagline) tagline.textContent = profile.tagline;
    setAvatar(byId('profile-avatar'), profile.avatar, profile.name); setAvatar(byId('about-avatar'), profile.avatar, profile.name);
    var linksRoot = byId('profile-links');
    if (linksRoot) {
      var iconMap = {};
      linksRoot.querySelectorAll('a,summary').forEach(function (node) { var label = (node.textContent || '').toLowerCase(); var icon = node.querySelector('svg,.icon'); if (icon && label) iconMap[label.indexOf('youtube') >= 0 ? 'youtube' : label.indexOf('discord') >= 0 ? 'discord' : label.indexOf('email') >= 0 ? 'email' : label.indexOf('about') >= 0 ? 'about' : label.indexOf('contact') >= 0 ? 'contact' : ''] = icon.cloneNode(true); });
      while (linksRoot.firstChild) linksRoot.removeChild(linksRoot.firstChild);
      function addLink(label, href, key) { if (!href) return; var anchor = document.createElement('a'); anchor.className = 'profile-chip'; anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener'; if (iconMap[key]) anchor.appendChild(iconMap[key]); anchor.appendChild(document.createTextNode(label)); linksRoot.appendChild(anchor); }
      addLink('YouTube', profile.links.youtube, 'youtube');
      if (profile.links.discord || profile.links.email) {
        var details = document.createElement('details'); details.className = 'contact-menu'; var summary = document.createElement('summary'); summary.className = 'profile-chip'; if (iconMap.contact) summary.appendChild(iconMap.contact); summary.appendChild(document.createTextNode('Contact')); details.appendChild(summary);
        var contact = document.createElement('div'); contact.className = 'contact-links';
        if (profile.links.discord) { var discord = document.createElement('a'); discord.href = profile.links.discord; discord.target = '_blank'; discord.rel = 'noopener'; if (iconMap.discord) discord.appendChild(iconMap.discord); discord.appendChild(document.createTextNode('Discord')); contact.appendChild(discord); }
        if (profile.links.email) { var mail = document.createElement('a'); mail.id = 'contact-email'; mail.href = 'mailto:' + profile.links.email; if (iconMap.email) mail.appendChild(iconMap.email); mail.appendChild(document.createTextNode('Email')); contact.appendChild(mail); }
        details.appendChild(contact); linksRoot.appendChild(details);
      }
      var aboutLink = document.createElement('a'); aboutLink.className = 'profile-chip'; aboutLink.href = '/about'; aboutLink.dataset.route = ''; if (iconMap.about) aboutLink.appendChild(iconMap.about); aboutLink.appendChild(document.createTextNode('About')); linksRoot.appendChild(aboutLink);
    }
    var langNodes = document.querySelectorAll('.profile-languages > div > span'); ['native', 'fluent', 'learning'].forEach(function (key, index) { if (langNodes[index]) langNodes[index].textContent = profile.languages[key]; });
    var about = byId('about-copy');
    if (about) { while (about.firstChild) about.removeChild(about.firstChild); current.about.text.split(/\n\s*\n/).filter(Boolean).forEach(function (paragraph) { var p = document.createElement('p'); p.textContent = paragraph; about.appendChild(p); }); }
    var stats = byId('about-stats-line'); if (stats) stats.hidden = !current.about.showStats;
    var root = document.documentElement, theme = current.theme;
    root.style.setProperty('--orange', theme.accent); root.style.setProperty('--orange-bright', derive(theme.accent, 1.18)); root.style.setProperty('--orange-soft', 'color-mix(in srgb, ' + theme.accent + ' 12%, transparent)');
    root.style.setProperty('--bg', theme.background); root.style.setProperty('--surface', theme.surface); root.style.setProperty('--card', theme.card); root.style.setProperty('--text', theme.text); root.style.setProperty('--muted', theme.muted);
    var title = byId('document-title'); if (title) title.textContent = profile.name + ' · Portfolio'; else if (document.title) document.title = profile.name + ' · Portfolio';
    window.dispatchEvent(new CustomEvent('portfolio:settings-applied', { detail: clone(current) }));
    return current;
  }
  function derive(color, factor) { var n = parseInt(color.slice(1), 16), r = Math.min(255, Math.round(((n >> 16) & 255) * factor)), g = Math.min(255, Math.round(((n >> 8) & 255) * factor)), b = Math.min(255, Math.round((n & 255) * factor)); return '#' + [r, g, b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
  function load() {
    if (requestPromise) return requestPromise;
    var base = cfg.api && cfg.api.baseUrl;
    if (!base || !window.fetch) { applyToDocument(current); return Promise.resolve(current); }
    var controller = window.AbortController ? new AbortController() : null;
    var timeout = setTimeout(function () { if (controller) controller.abort(); }, 6000);
    requestPromise = fetch(base.replace(/\/$/, '') + '/api/site/settings', { credentials: 'omit', cache: 'no-store', signal: controller && controller.signal }).then(function (response) { if (!response.ok) throw new Error('settings ' + response.status); return response.json(); }).then(function (data) { return applyToDocument(data); }).catch(function () { return applyToDocument(current); }).finally(function () { clearTimeout(timeout); });
    return requestPromise;
  }
  window.PortfolioSiteSettings = { defaults: clone(defaults), normalize: merge, load: load, applyToDocument: applyToDocument, getCurrent: function () { return clone(current); } };
  document.addEventListener('DOMContentLoaded', function () { if (!started) { started = true; if (document.getElementById('view-home')) load(); } });
}());
