(function analyticsAdminModule(global) {
  'use strict';
  var state = { root: null, request: null, notify: null, busy: false, generation: 0, days: 30 };
  var allowedDays = [7, 30, 90];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c];
    });
  }
  function number(value) { return Number(value || 0).toLocaleString('pt-BR'); }
  function safeDays(value) { value = Number(value); return allowedDays.indexOf(value) >= 0 ? value : 30; }
  function rows(list, empty, mapper) {
    return Array.isArray(list) && list.length ? list.map(mapper).join('') : '<tr><td colspan="2" class="analytics-empty">' + empty + '</td></tr>';
  }
  function shell() {
    return '<section class="analytics-root" aria-labelledby="analytics-title">' +
      '<div class="analytics-toolbar"><div><p class="analytics-eyebrow">SITE ANALYTICS</p><h2 id="analytics-title">Visão geral</h2><p class="analytics-subtitle">Acessos diretos ao portfólio, agregados em UTC.</p></div>' +
      '<div class="analytics-actions"><label for="analytics-days">Período</label><select id="analytics-days" data-analytics-days><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option></select><button type="button" class="button secondary" data-analytics-refresh>Atualizar</button></div></div>' +
      '<div class="analytics-status" data-analytics-status role="status" aria-live="polite">Carregando…</div>' +
      '<div class="analytics-metrics"><article><span>Visualizações</span><strong data-analytics-pageviews>—</strong><small>visualizações</small></article><article><span>Visitas</span><strong data-analytics-visits>—</strong><small>sessões de 30 min</small></article></div>' +
      '<p class="analytics-note">Uma visita permanece na mesma sessão por 30 minutos de inatividade. Nenhum IP ou localização é coletado no navegador.</p>' +
      '<div class="analytics-limited" data-analytics-limited hidden></div>' +
      '<section class="analytics-card"><div class="analytics-card-heading"><h3>Atividade diária</h3><span>UTC</span></div><div class="analytics-bars" data-analytics-daily></div></section>' +
      '<div class="analytics-grid"><section class="analytics-card"><h3>Páginas</h3><div class="analytics-table-wrap"><table><thead><tr><th>Caminho</th><th>Acessos</th></tr></thead><tbody data-analytics-pages></tbody></table></div></section>' +
      '<section class="analytics-card"><h3>Dispositivos</h3><div class="analytics-table-wrap"><table><thead><tr><th>Tipo</th><th>Acessos</th></tr></thead><tbody data-analytics-devices></tbody></table></div></section>' +
      '<section class="analytics-card"><h3>Referências</h3><div class="analytics-table-wrap"><table><thead><tr><th>Origem</th><th>Acessos</th></tr></thead><tbody data-analytics-referrers></tbody></table></div></section></div></section>';
  }
  function renderData(data, token) {
    if (token !== state.generation || !state.root) return;
    var root = state.root, total = data && data.totals || {};
    root.querySelector('[data-analytics-pageviews]').textContent = number(total.pageViews);
    root.querySelector('[data-analytics-visits]').textContent = number(total.visits);
    var daily = Array.isArray(data.daily) ? data.daily : [], max = Math.max.apply(null, daily.map(function (x) { return Number(x.pageViews) || 0; }).concat([1]));
    root.querySelector('[data-analytics-daily]').innerHTML = daily.length ? daily.map(function (item) {
      var value = Math.max(0, Number(item.pageViews) || 0), height = value ? Math.min(100, Math.max(4, value / max * 100)) : 0;
      return '<div class="analytics-bar-item"><div class="analytics-bar" style="height:' + height + '%" title="' + escapeHtml(item.date) + ': ' + number(value) + ' views"></div><span>' + escapeHtml(String(item.date || '').slice(5)) + '</span></div>';
    }).join('') : '<p class="analytics-empty">Nenhum acesso no período.</p>';
    root.querySelector('[data-analytics-pages]').innerHTML = rows(data.pages, 'Nenhuma página registrada.', function (x) { return '<tr><td><code>' + escapeHtml(x.path || '/') + '</code></td><td>' + number(x.pageViews) + '</td></tr>'; });
    root.querySelector('[data-analytics-devices]').innerHTML = rows(data.devices, 'Nenhum dispositivo registrado.', function (x) { return '<tr><td>' + escapeHtml(x.name || 'Desconhecido') + '</td><td>' + number(x.pageViews) + '</td></tr>'; });
    root.querySelector('[data-analytics-referrers]').innerHTML = rows(data.referrers, 'Nenhuma referência registrada.', function (x) { return '<tr><td>' + escapeHtml(!x.name || x.name === 'unknown' ? 'Acesso direto' : x.name) + '</td><td>' + number(x.pageViews) + '</td></tr>'; });
    var limited = root.querySelector('[data-analytics-limited]');
    limited.hidden = !data.limited;
    limited.textContent = data.limited ? 'Alguns dados deste período estão parcialmente disponíveis.' : '';
    root.querySelector('[data-analytics-status]').textContent = 'Atualizado agora · período de ' + safeDays(data.days || state.days) + ' dias';
  }
  function load(days, token) {
    state.busy = true;
    var path = '/api/analytics/summary?days=' + safeDays(days);
    return Promise.resolve(state.request(path)).then(function (data) { renderData(data || {}, token); }).catch(function (error) {
      if (token !== state.generation || !state.root) return;
      var missingWorker = error && (error.status === 404 || error.code === 404 || error.statusCode === 404);
      state.root.querySelector('[data-analytics-status]').innerHTML = (missingWorker ? 'Este Worker ainda não possui analytics. Atualize o Worker e tente novamente.' : 'Não foi possível carregar os analytics.') + ' <button type="button" class="analytics-inline-retry" data-analytics-retry>Tentar novamente</button>';
    }).finally(function () { if (token === state.generation) state.busy = false; });
  }
  function bind() {
    var root = state.root;
    root.querySelector('[data-analytics-days]').addEventListener('change', function (e) { state.days = safeDays(e.target.value); var token = ++state.generation; load(state.days, token); });
    root.querySelector('[data-analytics-refresh]').addEventListener('click', function () { var token = ++state.generation; load(state.days, token); });
    root.addEventListener('click', function (e) { if (e.target.closest('[data-analytics-retry]')) { var token = ++state.generation; load(state.days, token); } });
  }
  global.PortfolioAnalyticsAdmin = {
    render: function (options) { options = options || {}; state.root = options.container; state.request = options.request; state.notify = options.notify; state.days = 30; state.generation += 1; var token = state.generation; state.root.innerHTML = shell(); bind(); return load(state.days, token); },
    reset: function () { state.generation += 1; state.busy = false; if (state.root) state.root.innerHTML = ''; state.root = null; },
    isBusy: function () { return state.busy; },
    hasDirty: function () { return false; }
  };
}(window));
