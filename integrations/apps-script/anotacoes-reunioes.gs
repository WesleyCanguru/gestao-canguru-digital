/**
 * Bolsa · Anotações das reuniões comerciais
 *
 * Roda como o Wesley (Agenda + Drive dele). Quem chama é a função generate-proposal do Supabase,
 * quando alguém clica em "A reunião acabou" na aba Propostas. Nada roda sozinho, não há gatilho de tempo.
 *
 * Segurança: só responde a quem manda um login válido da Bolsa de alguém da equipe da agência
 * (o script confere o token no Supabase com a função i_am_staff_of). A chave abaixo é a pública (a mesma do site).
 *
 * Ações:
 *   { jwt, agency_id, action: "list" }             -> reuniões comerciais de hoje
 *   { jwt, agency_id, action: "notes", event_id }  -> texto das Anotações do Gemini daquela reunião
 */

var SUPABASE_URL = 'https://wtzphiyybitcucwkfpgv.supabase.co';
var SUPABASE_PUBLIC_KEY = 'sb_publishable_uLQGmz7lWazPN1Uqb4_4vQ_HggVpMz9';

function isStaff(jwt, agencyId) {
  if (!jwt || !agencyId) return false;
  var r = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/i_am_staff_of', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: 'Bearer ' + jwt },
    payload: JSON.stringify({ p_agency: Number(agencyId) }),
  });
  return r.getResponseCode() === 200 && r.getContentText().trim() === 'true';
}

// Só reuniões comerciais (padrão de nomes da Canguru).
var COMERCIAL = /Reuni[ãa]o de Diagn[óo]stico|Apresenta[çc][ãa]o de Proposta/i;

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return out({ error: 'json inválido' }); }
  if (!isStaff(body.jwt, body.agency_id)) return out({ error: 'unauthorized' });
  try {
    if (body.action === 'list') return out({ meetings: listToday() });
    if (body.action === 'notes') return out(notesFor(String(body.event_id || '')));
    return out({ error: 'ação desconhecida' });
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

function listToday() {
  var cal = CalendarApp.getDefaultCalendar();
  var tz = cal.getTimeZone();
  var now = new Date();
  var ymd = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var start = new Date(ymd + 'T00:00:00' + offset(tz, now));
  var end = new Date(start.getTime() + 24 * 3600 * 1000);
  return cal.getEvents(start, end)
    .filter(function (ev) { return COMERCIAL.test(ev.getTitle()); })
    .map(function (ev) {
      return {
        id: ev.getId(),
        title: ev.getTitle(),
        company: companyOf(ev.getTitle()),
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString(),
        guests: ev.getGuestList().map(function (g) { return g.getEmail(); }),
      };
    });
}

function notesFor(eventId) {
  var ev = CalendarApp.getEventById(eventId);
  if (!ev) return { error: 'Reunião não encontrada na agenda.' };
  var company = companyOf(ev.getTitle());
  var since = new Date(ev.getStartTime().getTime() - 3600 * 1000).toISOString();
  var q = "mimeType = 'application/vnd.google-apps.document' and title contains 'Gemini' and modifiedDate > '" + since + "'";
  var it = DriveApp.searchFiles(q);
  var best = null;
  var key = norm(company);
  while (it.hasNext()) {
    var f = it.next();
    var name = norm(f.getName());
    if (key && name.indexOf(key) === -1) continue;
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  if (!best) return { ready: false, company: company, title: ev.getTitle(), reason: 'O documento de Anotações do Gemini ainda não apareceu no Drive.' };
  var text = docText(best.getId());
  // O Gemini cria o documento no início e só preenche no fim.
  if (text.replace(/\s+/g, ' ').trim().length < 400) {
    return { ready: false, company: company, title: ev.getTitle(), file_id: best.getId(), reason: 'O Gemini ainda está escrevendo as anotações.' };
  }
  return { ready: true, company: company, title: ev.getTitle(), file_id: best.getId(), file_url: best.getUrl(), text: text.slice(0, 60000), guests: ev.getGuestList().map(function (g) { return g.getEmail(); }) };
}

function docText(id) {
  var doc = DocumentApp.openById(id);
  try {
    var parts = [];
    var walk = function (tabs) {
      tabs.forEach(function (t) {
        parts.push('## ' + t.getTitle() + '\n' + t.asDocumentTab().getBody().getText());
        walk(t.getChildTabs());
      });
    };
    walk(doc.getTabs());
    if (parts.length) return parts.join('\n\n');
  } catch (err) { /* documento sem abas */ }
  return doc.getBody().getText();
}

function companyOf(title) {
  var parts = String(title).split(/\s[—–-]\s/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : String(title).trim();
}
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function offset(tz, d) { var z = Utilities.formatDate(d, tz, 'Z'); return z.slice(0, 3) + ':' + z.slice(3); }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/** Rode uma vez pelo editor para autorizar Agenda, Drive e Documentos e ver as reuniões de hoje no log. */
function testar() { Logger.log(JSON.stringify(listToday(), null, 2)); }
