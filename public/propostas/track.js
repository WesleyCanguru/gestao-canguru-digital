/* Registro de abertura das propostas da Bolsa.
   Não registra nada quando:
   - a página é aberta com ?preview (o aparelho fica marcado e não conta mais nas próximas aberturas);
   - a página está dentro de um iframe (visualização dentro da Bolsa). */
(function () {
  var script = document.currentScript;
  var SLUG = script && script.getAttribute('data-slug');
  if (!SLUG) return;
  var URL_ = 'https://wtzphiyybitcucwkfpgv.supabase.co/functions/v1/proposal-track';
  var KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

  var params = new URLSearchParams(location.search);
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  var marked = false;
  try {
    if (params.has('preview')) localStorage.setItem('bolsa_preview', '1');
    if (params.get('preview') === 'off') localStorage.removeItem('bolsa_preview');
    marked = localStorage.getItem('bolsa_preview') === '1';
  } catch (e) { marked = params.has('preview') && params.get('preview') !== 'off'; }

  if (inFrame || marked) {
    if (!inFrame) {
      var bar = document.createElement('div');
      bar.textContent = 'Visualização da equipe: esta abertura não é registrada.';
      bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#13284D;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:calc(100% - 32px);text-align:center';
      document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bar); });
      if (document.body) document.body.appendChild(bar);
    }
    return;
  }

  var sid;
  try { sid = sessionStorage.getItem('pt_sid'); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('pt_sid', sid); } }
  catch (e) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function send(event, extra) {
    var payload = JSON.stringify(Object.assign({ slug: SLUG, event: event, session: sid }, extra || {}));
    try {
      fetch(URL_, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY }, body: payload }).catch(function () {});
    } catch (e) {}
  }
  send('open');
  var visible = 0, last = Date.now(), active = !document.hidden;
  function tick() { if (active) { visible += (Date.now() - last) / 1000; } last = Date.now(); }
  document.addEventListener('visibilitychange', function () {
    tick(); active = !document.hidden;
    if (document.hidden) send('read_time', { seconds: Math.round(visible) });
  });
  setInterval(function () { tick(); send('read_time', { seconds: Math.round(visible) }); }, 30000);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track="whatsapp"], #cta-whatsapp');
    if (a) send('whatsapp_click');
  });
})();
