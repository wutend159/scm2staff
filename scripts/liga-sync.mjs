// Liga-Sync: holt einmal täglich Spielplan (IFV-Kalender) und Tabelle/Resultate (Footstats)
// und schreibt sie in Supabase. Läuft als GitHub Action, ohne zusätzliche Pakete (Node 20).

const CONFIG = {
  team: 'SC Menzingen II',
  icsUrl: process.env.ICS_URL || 'https://matchcenter.ifv.ch/portaldata/1/nisrd/WebService/verein/calendar.asmx/Team?v=399&t=31577&sp=de&calName=SC%20Menzingen%20-%205.%20Liga%20II&format=ics',
  footstatsUrl: process.env.FOOTSTATS_URL || 'https://www.footstats.ch/de/leagues/ifv-5-liga/',
  group: 'Gruppe 3'
};
const UA = 'SCM2-Aufstellung/1.0 (privates Trainer-Tool, 1 Abruf pro Tag)';

/* ---------- Hilfen ---------- */
const decodeEntities = s => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = s => decodeEntities(s).replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');

/* ---------- Kalender (ICS) ---------- */
export function parseIcs(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n'); // Zeilen entfalten
  const out = []; let ev = null;
  const un = v => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase();
    ev[key] = un(line.slice(i + 1));
  }
  return out.map(e => {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(e.DTSTART || '');
    if (!m) return null;
    const [home, away] = (e.SUMMARY || '').split(/\s+-\s+/).map(t => t.replace(/\s*\(\d+\.?\)\s*$/, '').trim());
    const desc = (e.DESCRIPTION || '').split('\n').map(s => s.trim()).filter(Boolean);
    const nr = (desc.join(' ').match(/Spielnummer\s+(\d+)/) || [])[1] || (e.UID || '').split('@')[0];
    const idx = desc.findIndex(s => /^Spielnummer/.test(s));
    const status = idx >= 0 && desc[idx + 1] && !/^https?:/.test(desc[idx + 1]) ? desc[idx + 1] : '';
    const time = `${m[4]}:${m[5]}` === '00:00' ? '' : `${m[4]}:${m[5]}:00`;
    return {
      match_no: String(nr), date: `${m[1]}-${m[2]}-${m[3]}`, time, home: home || '', away: away || '',
      venue: (e.LOCATION || '').trim(), status, competition: (desc[0] || '').replace(/\s+/g, ' ')
        + (desc[1] && !/^Spielnummer/.test(desc[1]) ? ' ' + desc[1].replace(/\s+/g, ' ') : '')
    };
  }).filter(Boolean);
}

/* ---------- Footstats (HTML → Text-Bausteine) ---------- */
export function tokens(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\u0001').split('\u0001').map(clean).filter(Boolean);
}
const isInt = s => /^[+-]?\d+$/.test(s);
export function parseFootstats(html, group, now = new Date()) {
  const t = tokens(html);
  // Jede Stelle mit dem Gruppennamen probieren (z.B. auch Navigation); die erste mit Tabelle gewinnt.
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== group) continue;
    const r = parseGroupAt(t, i, now);
    if (r.table.length) return r;
  }
  throw new Error(`Footstats: Tabelle von «${group}» nicht gefunden`);
}
function parseGroupAt(t, start, now) {
  let end = t.length;
  for (let i = start + 1; i < t.length; i++) if (/^Gruppe \d+$/.test(t[i]) || /^Beste Torschützen/.test(t[i])) { end = i; break; }
  const seg = t.slice(start, end);
  const iRes = seg.indexOf('Letzte Ergebnisse'), iNext = seg.indexOf('Nächste Spiele');
  const tableSeg = seg.slice(0, iRes > 0 ? iRes : seg.length);

  // Tabelle: Rang, Team, Sp, S, U, N, T, GT, Diff, Pkt, (Form)
  const table = [];
  for (let i = 0; i < tableSeg.length - 9; i++) {
    const r = tableSeg;
    const rankOk = isInt(r[i]) && (table.length ? +r[i] > table[table.length - 1].rank : +r[i] === 1);
    if (!rankOk) continue;
    // Teamname kann ein- oder zweimal vorkommen (Kurz- und Langform)
    const names = isInt(r[i + 2]) ? 1 : 2;
    if (r.slice(i + 1, i + 1 + names).some(isInt) || !r.slice(i + 1 + names, i + 9 + names).every(isInt)) continue;
    {
      const team = r.slice(i + 1, i + 1 + names).sort((a, b) => b.length - a.length)[0];
      const n0 = i + 1 + names;
      const row = { rank: +r[i], team, sp: +r[n0], s: +r[n0 + 1], u: +r[n0 + 2], n: +r[n0 + 3], t: +r[n0 + 4], gt: +r[n0 + 5], diff: +r[n0 + 6], pkt: +r[n0 + 7], form: '' };
      let j = n0 + 8;
      while (j < r.length && /^[WDL]+$/.test(r[j]) && row.form.length < 10) { row.form += r[j]; j++; }
      table.push(row); i = j - 1;
    }
  }

  // Resultate: Datum, Heim, Tore, Gast
  const season0 = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const toIso = d => { const [dd, mm] = d.split('.').map(Number); return `${mm >= 7 ? season0 : season0 + 1}-${pad(mm)}-${pad(dd)}`; };
  const results = [];
  if (iRes > 0) {
    const r = seg.slice(iRes + 1, iNext > iRes ? iNext : seg.length);
    for (let i = 0; i < r.length; i++) {
      if (!/^\d{2}\.\d{2}\.$/.test(r[i])) continue;
      const home = r[i + 1]; let k = i + 2, score = '', m = null;
      while (k < r.length && k < i + 6 && !m) { score = (score + ' ' + r[k]).trim(); m = /^(\d+)\s*[-:]\s*(\d+)$/.exec(score); k++; }
      if (m && r[k]) results.push({ date: toIso(r[i]), home, away: r[k], home_goals: +m[1], away_goals: +m[2] });
    }
  }
  return { table, results };
}

/* ---------- Supabase REST ---------- */
function sb() {
  const branch = process.env.GITHUB_REF_NAME || '';
  const live = branch === 'main';
  const url = (live ? process.env.SUPABASE_URL : process.env.SUPABASE_URL_TEST || '').trim().replace(/\/+$/, '');
  const key = (live ? process.env.SUPABASE_SERVICE_KEY : process.env.SUPABASE_SERVICE_KEY_TEST || '').trim();
  if (!url || !key) throw new Error(`Supabase-Secrets für ${live ? 'live' : 'test'} fehlen (Branch ${branch || '?'}).`);
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const call = async (method, path, body, prefer) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
  };
  return {
    target: live ? 'live' : 'test',
    upsert: (table, rows, onConflict) => rows.length ? call('POST', `${table}?on_conflict=${onConflict}`, rows, 'resolution=merge-duplicates') : null,
    insert: (table, row) => call('POST', table, row),
    del: (table, query) => call('DELETE', `${table}?${query}`)
  };
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,text/calendar,*/*' } });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const db = sb();
  const msgs = []; let ok = true;
  try {
    const fx = parseIcs(await get(CONFIG.icsUrl));
    await db.upsert('fixtures', fx.map(f => ({ ...f, updated_at: new Date().toISOString() })), 'match_no');
    msgs.push(`Spielplan: ${fx.length} Spiele`);
  } catch (e) { ok = false; msgs.push(`Spielplan-Fehler: ${e.message}`); }
  try {
    const { table, results } = parseFootstats(await get(CONFIG.footstatsUrl), CONFIG.group);
    if (table.length < 4) throw new Error(`Tabelle nicht erkannt (${table.length} Zeilen)`);
    await db.upsert('league_table', [{ group_name: CONFIG.group, rows: table, fetched_at: new Date().toISOString() }], 'group_name');
    await db.upsert('results', results.map(r => ({ ...r, source: 'footstats' })), 'date,home,away');
    msgs.push(`Tabelle: ${table.length} Teams, Resultate: ${results.length}`);
  } catch (e) { ok = false; msgs.push(`Footstats-Fehler: ${e.message}`); }
  const message = msgs.join(' · ');
  console.log(`[${db.target}] ${message}`);
  await db.insert('sync_log', { ok, message });
  await db.del('sync_log', `ran_at=lt.${new Date(Date.now() - 60 * 864e5).toISOString()}`);
  if (!ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
