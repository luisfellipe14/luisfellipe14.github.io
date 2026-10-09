/**
 * Contraprova — luisfellipe.com
 * Módulo de Rastreamento de Tráfego Orgânico & Atribuição de Leads (WhatsApp)
 * 
 * 100% Client-side, zero cookies de terceiros, em total conformidade com a LGPD.
 * Captura: Referrer orgânico (Google, Bing, Instagram, etc.), parâmetros UTM e página de entrada.
 * Aplica: Atribuição automática em todos os links e botões de contato no WhatsApp.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'cp_lead_attribution';
  var STATS_KEY = 'cp_local_stats';

  // 1. Extração de parâmetros da URL
  function getQueryParams() {
    var params = {};
    try {
      var search = window.location.search.substring(1);
      if (search) {
        var pairs = search.split('&');
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          var key = decodeURIComponent(pair[0]);
          var value = decodeURIComponent(pair[1] || '');
          params[key] = value;
        }
      }
    } catch (e) {}
    return params;
  }

  // 2. Classificação de Referrer Orgânico
  function detectOrganicSource() {
    var ref = document.referrer || '';
    if (!ref) return 'Acesso Direto';
    try {
      var hostname = new URL(ref).hostname.toLowerCase();
      if (hostname.indexOf('google.') !== -1) return 'Google (Orgânico)';
      if (hostname.indexOf('bing.') !== -1) return 'Bing (Orgânico)';
      if (hostname.indexOf('yahoo.') !== -1) return 'Yahoo (Orgânico)';
      if (hostname.indexOf('duckduckgo.') !== -1) return 'DuckDuckGo (Orgânico)';
      if (hostname.indexOf('instagram.com') !== -1 || hostname.indexOf('l.instagram.com') !== -1) return 'Instagram';
      if (hostname.indexOf('linkedin.com') !== -1 || hostname.indexOf('lnkd.in') !== -1) return 'LinkedIn';
      if (hostname.indexOf('facebook.com') !== -1 || hostname.indexOf('l.facebook.com') !== -1) return 'Facebook';
      if (hostname.indexOf('x.com') !== -1 || hostname.indexOf('t.co') !== -1 || hostname.indexOf('twitter.com') !== -1) return 'X / Twitter';
      if (hostname.indexOf('whatsapp.com') !== -1) return 'WhatsApp (Link)';
      if (hostname.indexOf('youtube.com') !== -1) return 'YouTube';
      if (hostname.indexOf(window.location.hostname) !== -1) return ''; // Navegação interna
      return 'Outro site (' + hostname + ')';
    } catch (e) {
      return 'Referência externa';
    }
  }

  // 3. Inicialização e Persistência de Atribuição
  function initAttribution() {
    var query = getQueryParams();
    var organic = detectOrganicSource();

    var existingData = null;
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) existingData = JSON.parse(stored);
    } catch (e) {}

    // Se já temos atribuição na sessão e este é um clique interno, preservamos a fonte original
    if (existingData && !query.utm_source && !query.src && !organic) {
      return existingData;
    }

    var source = query.utm_source || query.src || (organic || (existingData ? existingData.source : 'Acesso Direto'));
    var medium = query.utm_medium || (organic.indexOf('Orgânico') !== -1 ? 'organico' : (existingData ? existingData.medium : 'direto'));
    var campaign = query.utm_campaign || (existingData ? existingData.campaign : '');
    var landingPage = existingData ? existingData.landingPage : window.location.pathname;

    var attribution = {
      source: source,
      medium: medium,
      campaign: campaign,
      landingPage: landingPage,
      currentPage: window.location.pathname,
      timestamp: new Date().toISOString()
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
      // Fallback em localStorage para histórico de retorno
      if (!localStorage.getItem(STORAGE_KEY + '_first')) {
        localStorage.setItem(STORAGE_KEY + '_first', JSON.stringify(attribution));
      }
    } catch (e) {}

    return attribution;
  }

  // 4. Registro de Estatísticas Locais de Ferramentas (sem envio externo não autorizado)
  function recordToolUsage(toolSlug, status) {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      var stats = raw ? JSON.parse(raw) : { tools: {}, pageviews: 0 };
      stats.pageviews = (stats.pageviews || 0) + 1;
      if (!stats.tools[toolSlug]) stats.tools[toolSlug] = { views: 0, completions: 0, ctaClicks: 0 };
      
      if (status === 'view') stats.tools[toolSlug].views++;
      if (status === 'complete') stats.tools[toolSlug].completions++;
      if (status === 'cta') stats.tools[toolSlug].ctaClicks++;
      
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));

      // Suporte para Google Tag Manager / GA4 se o usuário tiver tag instalada
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: 'ferramenta_' + status,
          tool_name: toolSlug
        });
      }
    } catch (e) {}
  }

  // 5. Injeção Dinâmica de Atribuição nos Links do WhatsApp
  function enhanceWhatsAppLinks() {
    var attribution = initAttribution();
    var links = document.querySelectorAll('a[href*="wa.me"], a.btn-whatsapp');

    var tagTexto = ' [Origem: ' + (attribution.source || 'Direto') + ']';

    links.forEach(function (link) {
      try {
        var href = link.getAttribute('href');
        if (!href || href.indexOf('wa.me') === -1) return;

        // Se o link já tem a tag injetada, não duplica
        if (href.indexOf('Origem:') !== -1) return;

        var url = new URL(href);
        var text = url.searchParams.get('text') || '';

        // Anexa a tag ao final do texto pré-preenchido
        var novoTexto = text + tagTexto;
        url.searchParams.set('text', novoTexto);
        link.setAttribute('href', url.toString());

        // Event listener para monitorar o clique de conversão
        link.addEventListener('click', function () {
          var toolElem = document.querySelector('[data-tool-slug]');
          var toolSlug = toolElem ? toolElem.getAttribute('data-tool-slug') : window.location.pathname;
          recordToolUsage(toolSlug, 'cta');
        });
      } catch (e) {}
    });
  }

  // Executa ao carregar o DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAttribution();
      enhanceWhatsAppLinks();
    });
  } else {
    initAttribution();
    enhanceWhatsAppLinks();
  }

  // Exporta API pública mínima para os simuladores
  window.ContraprovaTracker = {
    getAttribution: initAttribution,
    recordToolUsage: recordToolUsage,
    enhanceWhatsAppLinks: enhanceWhatsAppLinks
  };
})();
