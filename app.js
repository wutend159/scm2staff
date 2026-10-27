'use strict';

/* =========================================================================
   Konfiguration & Konstanten
   ========================================================================= */
const CFG = window.APP_CONFIG || {};
const DEMO = !(CFG.supabaseUrl && CFG.supabaseAnonKey);
const TEAM = CFG.teamName || 'Aufstellung';
const INITIAL = CFG.initialPlayers || {};

const POSITIONS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LF', 'RF', 'ST'];
const POS_NAMES = {
  TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linker Verteidiger', RV: 'Rechter Verteidiger',
  DM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld', OM: 'Offensives Mittelfeld',
  LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld', LF: 'Linker Flügel', RF: 'Rechter Flügel', ST: 'Stürmer'
};
// Wer Position X hat, kann auch auf diesen Positionen spielen (nur in diese Richtung).
const ALSO_PLAYS = { OM: ['ZM', 'ST'], DM: ['ZM', 'IV'], LM: ['LF'], RM: ['RF'], LV: ['LM'], RV: ['RM'] };

const ROLES = { spieler: 'Spieler', spielertrainer: 'Spielertrainer', trainer: 'Trainer' };
const OUT_KINDS = { lazarett: { icon: '🩼', label: 'Lazarett' }, sonder: { icon: '🏋️', label: 'Sonderaufgabe' } };
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// [Position, x %, y %] – y = 0 gegnerisches Tor, 100 eigenes Tor.
// Reihenfolge: Torwart, Abwehr links→rechts, Mittelfeld, Angriff.
const BACK4 = [['TW', 50, 91], ['LV', 14, 71], ['IV', 37, 75], ['IV', 63, 75], ['RV', 86, 71]];
const BACK3 = [['TW', 50, 91], ['IV', 25, 74], ['IV', 50, 77], ['IV', 75, 74]];
const MID4 = [['LM', 14, 46], ['ZM', 37, 50], ['ZM', 63, 50], ['RM', 86, 46]];
const FORMATIONS = {
  '4-4-2': [...BACK4, ...MID4, ['ST', 37, 21], ['ST', 63, 21]],
  '4-4-1-1': [...BACK4, ...MID4, ['OM', 50, 33], ['ST', 50, 16]],
  '4-3-3': [...BACK4, ['ZM', 27, 49], ['DM', 50, 56], ['ZM', 73, 49], ['LF', 16, 24], ['ST', 50, 18], ['RF', 84, 24]],
  '4-2-3-1': [...BACK4, ['DM', 35, 57], ['DM', 65, 57], ['LM', 15, 36], ['OM', 50, 38], ['RM', 85, 36], ['ST', 50, 16]],
  '4-1-4-1': [...BACK4, ['DM', 50, 58], ['LM', 14, 41], ['ZM', 37, 44], ['ZM', 63, 44], ['RM', 86, 41], ['ST', 50, 17]],
  '3-5-2': [...BACK3, ['LM', 11, 45], ['ZM', 32, 50], ['DM', 50, 58], ['ZM', 68, 50], ['RM', 89, 45], ['ST', 37, 20], ['ST', 63, 20]],
  '3-4-3': [...BACK3, ['LM', 13, 49], ['ZM', 38, 52], ['ZM', 62, 52], ['RM', 87, 49], ['LF', 18, 23], ['ST', 50, 18], ['RF', 82, 23]]
};
const DEFAULT_FORMATION = '4-4-2';
const WEEK_OPTIONS = [1, 2, 3, 4];
const DEMO_PERIODS = [
  { start_date: '2026-08-01', end_date: '2026-10-26', weekdays: [1, 3] },
  { start_date: '2026-10-27', end_date: '2026-11-30', weekdays: [3] },
  { start_date: '2026-12-01', end_date: '2027-02-28', weekdays: [2] }
];

/* =========================================================================
   Hilfsfunktionen
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const clone = o => JSON.parse(JSON.stringify(o));
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const utc = iso => new Date(`${iso}T00:00:00Z`);
const isoAdd = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wdIdx = iso => (utc(iso).getUTCDay() + 6) % 7; // 0 = Montag
const weekOf = iso => isoAdd(iso, -wdIdx(iso));
function fmtDate(iso, withDay = true, withYear = true) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${withDay ? WEEKDAYS[wdIdx(iso)] + ' ' : ''}${d}.${m}.${withYear ? y : ''}`;
}
const fmtTime = t => (t ? t.slice(0, 5) : '');
function fmtStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
const emailName = e => (e || '').split('@')[0];
const nullDate = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/* =========================================================================
   Datenzugriff: Demo (Browser) oder Supabase
   ========================================================================= */
const PLAYER_DEFAULTS = {
  sp_user_id: null, sp_name: '', sp_roles: '', first_name: '', last_name: '', nickname: '', positions: [],
  role: 'spieler', out_kind: null, out_title: '', out_from: null, out_until: null, is_guest: false, active: true
};
const TABLES = ['players', 'events', 'participations', 'attendance_overrides', 'training_periods', 'training_cancellations', 'lineups'];

function makeLocalApi() {
  const KEY = 'aufstellung-demo-v2';
  const db = lsGet(KEY, null) || {};
  for (const t of TABLES) db[t] = db[t] || [];
  if (!db.training_periods.length && !db._seeded) { db.training_periods = DEMO_PERIODS.map(p => ({ ...p, id: uid() })); db._seeded = true; }
  const save = () => lsSet(KEY, db);
  save();
  const now = () => new Date().toISOString();
  const upsertBy = (table, match, row) => {
    const i = db[table].findIndex(match);
    if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push(row);
    save(); return clone(i >= 0 ? db[table][i] : row);
  };
  return {
    async session() { return { email: 'demo@lokal' }; },
    async signIn() {}, async signOut() {},
    async isCoach() { return true; },
    async changePassword() { throw new Error('Im Demo-Modus gibt es kein Passwort.'); },
    async loadAll() { const o = {}; for (const t of TABLES) o[t] = clone(db[t]); return o; },
    async savePlayer(p) {
      if (p.id) return upsertBy('players', x => x.id === p.id, p);
      const n = { ...PLAYER_DEFAULTS, ...p, id: uid(), created_at: now() }; db.players.push(n); save(); return clone(n);
    },
    async insertPlayers(list) {
      const out = list.map(p => ({ ...PLAYER_DEFAULTS, ...p, id: uid(), created_at: now() }));
      db.players.push(...out); save(); return clone(out);
    },
    async deletePlayer(id) {
      db.players = db.players.filter(p => p.id !== id);
      db.participations = db.participations.filter(x => x.player_id !== id);
      db.attendance_overrides = db.attendance_overrides.filter(x => x.player_id !== id); save();
    },
    async upsertEvent(ev) {
      const e = db.events.find(x => x.sp_key === ev.sp_key);
      if (e) { Object.assign(e, ev); save(); return clone(e); }
      const n = { team_name: '', name: '', time_start: '', time_meet: '', opponent: '', ...ev, id: uid(), created_at: now() };
      db.events.push(n); save(); return clone(n);
    },
    async updateEvent(id, fields) { return upsertBy('events', x => x.id === id, fields); },
    async deleteEvent(id) {
      db.events = db.events.filter(e => e.id !== id);
      for (const t of ['participations', 'attendance_overrides', 'lineups']) db[t] = db[t].filter(x => x.event_id !== id);
      save();
    },
    async setParticipations(eid, rows) {
      db.participations = db.participations.filter(x => x.event_id !== eid).concat(rows.map(r => ({ event_id: eid, ...r }))); save();
    },
    async setOverride(eid, pid, present) {
      db.attendance_overrides = db.attendance_overrides.filter(x => !(x.event_id === eid && x.player_id === pid));
      if (present !== null) db.attendance_overrides.push({ event_id: eid, player_id: pid, present, updated_by_email: 'demo@lokal', updated_at: now() });
      save();
    },
    async savePeriod(p) { return p.id ? upsertBy('training_periods', x => x.id === p.id, p) : upsertBy('training_periods', () => false, { ...p, id: uid() }); },
    async deletePeriod(id) { db.training_periods = db.training_periods.filter(x => x.id !== id); save(); },
    async setCancelled(date, on) {
      db.training_cancellations = db.training_cancellations.filter(x => x.date !== date);
      if (on) db.training_cancellations.push({ date, note: '' });
      save();
    },
    async saveLineup(l) {
      const row = { event_id: l.event_id, title: l.title, data: l.data, updated_by_email: 'demo@lokal', updated_at: now() };
      if (l.id) return upsertBy('lineups', x => x.id === l.id, row);
      const n = { ...row, id: uid(), created_by_email: 'demo@lokal', created_at: now() }; db.lineups.push(n); save(); return clone(n);
    },
    async deleteLineup(id) { db.lineups = db.lineups.filter(l => l.id !== id); save(); }
  };
}

function makeSupabaseApi() {
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  let email = null;
  async function all(table) {
    const out = []; const step = 1000;
    for (let from = 0; ; from += step) {
      const rows = chk(await sb.from(table).select('*').range(from, from + step - 1));
      out.push(...rows);
      if (rows.length < step) return out;
    }
  }
  return {
    async session() {
      const { data } = await sb.auth.getSession();
      email = data.session?.user?.email || null;
      return data.session ? { email } : null;
    },
    async signIn(e, p) {
      const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'E-Mail oder Passwort ist falsch.' : error.message);
      email = data.user.email;
    },
    async signOut() { await sb.auth.signOut(); },
    async isCoach() { return !!chk(await sb.rpc('is_coach')); },
    async changePassword(pw) { chk(await sb.auth.updateUser({ password: pw })); },
    async loadAll() {
      const res = await Promise.all(TABLES.map(all));
      return Object.fromEntries(TABLES.map((t, i) => [t, res[i]]));
    },
    async savePlayer(p) {
      const { id, created_at, ...rest } = p;
      if (id) return chk(await sb.from('players').update(rest).eq('id', id).select().single());
      return chk(await sb.from('players').insert({ ...PLAYER_DEFAULTS, ...rest }).select().single());
    },
    async insertPlayers(list) {
      if (!list.length) return [];
      return chk(await sb.from('players').insert(list.map(p => ({ ...PLAYER_DEFAULTS, ...p }))).select());
    },
    async deletePlayer(id) { chk(await sb.from('players').delete().eq('id', id)); },
    async upsertEvent(ev) { return chk(await sb.from('events').upsert(ev, { onConflict: 'sp_key' }).select().single()); },
    async updateEvent(id, fields) { return chk(await sb.from('events').update(fields).eq('id', id).select().single()); },
    async deleteEvent(id) { chk(await sb.from('events').delete().eq('id', id)); },
    async setParticipations(eid, rows) {
      chk(await sb.from('participations').delete().eq('event_id', eid));
      if (rows.length) chk(await sb.from('participations').insert(rows.map(r => ({ event_id: eid, ...r }))));
    },
    async setOverride(eid, pid, present) {
      if (present === null) chk(await sb.from('attendance_overrides').delete().eq('event_id', eid).eq('player_id', pid));
      else chk(await sb.from('attendance_overrides').upsert({ event_id: eid, player_id: pid, present, updated_by_email: email, updated_at: new Date().toISOString() }, { onConflict: 'event_id,player_id' }));
    },
    async savePeriod(p) {
      const { id, created_at, ...rest } = p;
      if (id) return chk(await sb.from('training_periods').update(rest).eq('id', id).select().single());
      return chk(await sb.from('training_periods').insert(rest).select().single());
    },
    async deletePeriod(id) { chk(await sb.from('training_periods').delete().eq('id', id)); },
    async setCancelled(date, on) {
      if (on) chk(await sb.from('training_cancellations').upsert({ date }, { onConflict: 'date' }));
      else chk(await sb.from('training_cancellations').delete().eq('date', date));
    },
    async saveLineup(l) {
      const row = { event_id: l.event_id, title: l.title, data: l.data, updated_by_email: email, updated_at: new Date().toISOString() };
      if (l.id) return chk(await sb.from('lineups').update(row).eq('id', l.id).select().single());
      return chk(await sb.from('lineups').insert(row).select().single());
    },
    async deleteLineup(id) { chk(await sb.from('lineups').delete().eq('id', id)); }
  };
}

const api = DEMO ? makeLocalApi() : makeSupabaseApi();

/* =========================================================================
   Zustand
   ========================================================================= */
const st = {
  user: null,
  tab: 'lineup',
  data: null,
  pmap: new Map(),     // playerId → Spieler
  part: new Map(),     // eventId → Map(playerId → Status)
  ovr: new Map(),      // eventId → Map(playerId → true/false)
  joined: new Map(),   // playerId → erstes Datum mit Rückmeldung
  sessions: [],        // Trainings (geplant + importiert), neueste zuerst
  gameId: null,
  draft: null,
  dirty: false,
  sel: null,
  pendingSlot: null,
  drag: null,
  nWeeks: WEEK_OPTIONS.includes(lsGet('nWeeks', 3)) ? lsGet('nWeeks', 3) : 3,
  pFilter: 'kader',
  pSearch: '',
  addSearch: '',
  preview: null,
  busy: false,
  showOld: false,
  exportOpts: Object.assign({ opp: true, date: true, time: true }, lsGet('exportOpts', {}))
};

async function reload() {
  st.data = await api.loadAll();
  st.pmap = new Map(st.data.players.map(p => [p.id, p]));
  const evDate = new Map(st.data.events.map(e => [e.id, e.date]));
  st.part = new Map(); st.ovr = new Map(); st.joined = new Map();
  const join = (pid, date) => { if (date && (!st.joined.has(pid) || date < st.joined.get(pid))) st.joined.set(pid, date); };
  for (const x of st.data.participations) {
    if (!st.part.has(x.event_id)) st.part.set(x.event_id, new Map());
    st.part.get(x.event_id).set(x.player_id, x.status || 'yes');
    if ((x.status || 'yes') !== 'none') join(x.player_id, evDate.get(x.event_id));
  }
  for (const x of st.data.attendance_overrides) {
    if (!st.ovr.has(x.event_id)) st.ovr.set(x.event_id, new Map());
    st.ovr.get(x.event_id).set(x.player_id, x.present);
    if (x.present) join(x.player_id, evDate.get(x.event_id));
  }
  st.sessions = buildSessions();
}

/* =========================================================================
   Trainings: Plan, Absagen, Präsenz
   ========================================================================= */
function buildSessions() {
  const today = todayIso();
  const m = new Map();
  const get = d => { if (!m.has(d)) m.set(d, { date: d, planned: false, event: null, cancelled: false }); return m.get(d); };
  for (const per of st.data.training_periods) {
    const days = new Set(per.weekdays || []);
    if (!days.size || !per.start_date || !per.end_date) continue;
    for (let d = per.start_date; d <= per.end_date; d = isoAdd(d, 1)) if (days.has(wdIdx(d))) get(d).planned = true;
  }
  for (const e of st.data.events) if (e.kind === 'training') { const s = get(e.date); if (!s.event) s.event = e; }
  for (const c of st.data.training_cancellations) get(c.date).cancelled = true;
  const gameDays = new Set(st.data.events.filter(e => e.kind === 'spiel').map(e => e.date));
  for (const s of m.values()) {
    // Ein Spiel am selben Tag ersetzt das geplante Training.
    s.game = !s.event && gameDays.has(s.date);
    s.status = s.cancelled || s.game ? 'cancelled' : s.event ? 'data' : s.date > today ? 'future' : 'missing';
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
}
const sessionByDate = d => st.sessions.find(s => s.date === d);

function isPresent(eventId, pid) {
  const o = st.ovr.get(eventId);
  if (o && o.has(pid)) return o.get(pid);
  return st.part.get(eventId)?.get(pid) === 'yes';
}
const isManual = (eventId, pid) => !!st.ovr.get(eventId)?.has(pid);

function outActive(p, ref = todayIso()) {
  if (!p || !p.out_kind || !p.out_from) return false;
  return ref >= p.out_from && (!p.out_until || ref < p.out_until);
}
const inOutPeriod = (p, date) => outActive(p, date);
function neutralReason(p, date) {
  const j = st.joined.get(p.id);
  if (!j || date < j) return 'noch nicht im Team';
  if (inOutPeriod(p, date)) return `ausser Gefecht (${OUT_KINDS[p.out_kind].label})`;
  return null;
}

// Fenster: die letzten N Wochen, in denen mindestens ein Training stattgefunden hat.
// Wochen ohne Training (Pause) werden übersprungen.
function presenceWindow(ref) {
  const past = st.sessions.filter(s => s.date <= ref && s.status !== 'future');
  const weeks = []; const byWeek = new Map();
  for (const s of past) {
    const w = weekOf(s.date);
    if (!byWeek.has(w)) { byWeek.set(w, []); weeks.push(w); }
    byWeek.get(w).push(s);
  }
  const q = weeks.filter(w => byWeek.get(w).some(s => s.status === 'data')).slice(0, st.nWeeks);
  const oldest = q[q.length - 1];
  return {
    weeks: q,
    sessions: q.flatMap(w => byWeek.get(w)),
    missing: past.filter(s => s.status === 'missing' && (!oldest || s.date >= oldest))
  };
}

// Trainings derselben Woche zählen gleich; die jüngste Woche zählt am meisten.
function attendance(pid, win) {
  const p = st.pmap.get(pid);
  if (!p || !win.weeks.length) return null;
  const W = win.weeks.length;
  let num = 0, den = 0, count = 0, total = 0;
  const marks = win.sessions.map(s => {
    const w = weekOf(s.date);
    const m = { s, w, kind: 'missing', manual: false, note: '' };
    if (s.status === 'cancelled') { m.kind = 'cancel'; m.note = s.game ? 'Spiel statt Training' : 'abgesagt'; return m; }
    if (s.status !== 'data') { m.note = 'Daten fehlen'; return m; }
    const nr = neutralReason(p, s.date);
    if (nr) { m.kind = 'neutral'; m.note = nr; return m; }
    const here = isPresent(s.event.id, pid);
    m.kind = here ? 'on' : 'off'; m.manual = isManual(s.event.id, pid);
    m.note = here ? 'dabei' : 'nicht dabei';
    const weight = W - win.weeks.indexOf(w);
    den += weight; total++;
    if (here) { num += weight; count++; }
    return m;
  }).reverse();
  return { pct: den ? Math.round((100 * num) / den) : null, count, total, marks };
}
const pctCls = p => (p >= 75 ? 'hi' : p >= 50 ? 'md' : 'lo');
function dotsHtml(info) {
  if (!info) return '';
  const groups = [];
  for (const m of info.marks) {
    if (!groups.length || groups[groups.length - 1].w !== m.w) groups.push({ w: m.w, items: [] });
    groups[groups.length - 1].items.push(m);
  }
  return `<span class="dots" aria-label="${info.count} von ${info.total} Trainings">${groups.map(g =>
    `<span class="wk">${g.items.map(m => `<span class="dot ${m.kind}${m.manual ? ' man' : ''}" title="${esc(fmtDate(m.s.date))}: ${esc(m.note)}${m.manual ? ' (von Hand)' : ''}"></span>`).join('')}</span>`
  ).join('')}</span>`;
}
function attHtml(info) {
  if (!info) return '<span class="small muted">–</span>';
  return `<span class="pct ${info.pct == null ? '' : pctCls(info.pct)}" title="Gewichtete Präsenz">${info.pct == null ? '–' : info.pct + '%'}</span>${dotsHtml(info)}`;
}
const countsForPresence = p => p.active && !p.is_guest && p.role !== 'trainer';
function weekSeg() {
  return `<span class="seg-label">Präsenz der letzten
    <span class="seg" role="group" aria-label="Anzahl Wochen">${WEEK_OPTIONS.map(n =>
      `<button type="button" data-act="nweeks" data-n="${n}" aria-pressed="${st.nWeeks === n}">${n}</button>`).join('')}</span>
    ${st.nWeeks === 1 ? 'Woche' : 'Wochen'}</span>`;
}

/* =========================================================================
   Spieler
   ========================================================================= */
function displayName(p) {
  if (!p) return 'Unbekannt';
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return p.nickname || full || p.sp_name || 'Ohne Namen';
}
function fullName(p) { return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.sp_name || ''; }
function shortName(p) {
  if (!p) return '?';
  if (p.nickname) return p.nickname;
  if (p.last_name) return `${p.first_name} ${p.last_name.split(' ').pop()[0]}.`;
  return p.first_name || p.sp_name || '?';
}
const byName = (a, b) => displayName(a).localeCompare(displayName(b), 'de');
const posChips = p => (p.positions || []).map(x => `<span class="pos" title="${esc(POS_NAMES[x] || x)}">${esc(x)}</span>`).join('');
// 0 = Stammposition, 1 = kann diese Position auch, 2 = passt nicht, null = keine Positionen erfasst
function posTier(p, pos) {
  const ps = p.positions || [];
  if (!ps.length) return null;
  if (ps.includes(pos)) return 0;
  if (ps.some(x => (ALSO_PLAYS[x] || []).includes(pos))) return 1;
  return 2;
}
function outBadge(p, ref) {
  if (!outActive(p, ref)) return '';
  const k = OUT_KINDS[p.out_kind];
  return `<span class="badge out" title="${esc(k.label)}${p.out_until ? ', Comeback ' + esc(fmtDate(p.out_until)) : ''}">${k.icon} ${esc(p.out_title || k.label)}</span>`;
}
function roleBadge(p) { return p.role && p.role !== 'spieler' ? `<span class="badge">${ROLES[p.role]}</span>` : ''; }
function comeback(p, game) {
  if (!p.out_until || !game) return false;
  const prev = games().filter(g => g.date < game.date).pop();
  return p.out_until <= game.date && (!prev || p.out_until > prev.date);
}

/* =========================================================================
   Grundgerüst
   ========================================================================= */
const TABS = [['lineup', 'Aufstellung'], ['presence', 'Präsenz'], ['players', 'Spieler'], ['trainings', 'Trainings'], ['import', 'Import']];
function renderShell() {
  $('#app').innerHTML = `
    <header class="top">
      <div class="top-row">
        <div class="brand">${esc(TEAM)}</div>
        <div class="who">
          <span title="${esc(st.user.email)}">${esc(st.user.email)}</span>
          ${DEMO ? '' : '<button class="btn ghost small" data-act="pw">Passwort</button><button class="btn ghost small" data-act="logout">Abmelden</button>'}
        </div>
      </div>
      <nav class="tabs" role="tablist">${TABS.map(([k, l]) =>
        `<button class="tab" role="tab" data-act="tab" data-tab="${k}" aria-selected="${st.tab === k}">${l}</button>`).join('')}</nav>
    </header>
    ${DEMO ? '<div class="demo-bar">Demo-Modus: Die Daten bleiben nur in diesem Browser. Für den gemeinsamen Betrieb Supabase in config.js eintragen.</div>' : ''}
    <main id="view"></main>`;
  renderView();
}
function renderView() {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === st.tab)));
  const v = $('#view');
  if (!v) return;
  const views = { lineup: () => (st.draft ? editorHtml() : lineupHomeHtml()), presence: presenceHtml, players: playersHtml, trainings: trainingsHtml, import: importHtml };
  v.innerHTML = views[st.tab]();
}

/* =========================================================================
   Aufstellung – Übersicht
   ========================================================================= */
function games() { return st.data.events.filter(e => e.kind === 'spiel').sort((a, b) => a.date.localeCompare(b.date) || (a.time_start || '').localeCompare(b.time_start || '')); }
function defaultGameId() {
  const g = games(); if (!g.length) return null;
  const t = todayIso();
  return (g.find(e => e.date >= t) || g[g.length - 1]).id;
}
const eventById = id => st.data.events.find(e => e.id === id);
function signedUp(gameId) {
  const m = st.part.get(gameId) || new Map();
  return [...m].filter(([, s]) => s === 'yes').map(([id]) => st.pmap.get(id)).filter(Boolean);
}
function miniPitch(data) {
  const f = FORMATIONS[data.formation] || FORMATIONS[DEFAULT_FORMATION];
  return `<div class="mini-pitch" aria-hidden="true">${f.map(([, x, y], i) =>
    `<i class="${data.slots?.[i] ? '' : 'e'}" style="left:${x}%;top:${y}%"></i>`).join('')}</div>`;
}

function lineupHomeHtml() {
  const g = games();
  if (!g.length) {
    return `<div class="panel empty"><h2>Noch kein Spiel vorhanden</h2>
      <p>Exportiere in SpielerPlus die Teilnahmen des nächsten Spiels als CSV und lade sie im Tab Import hoch.</p>
      <button class="btn primary" data-act="tab" data-tab="import">Zum Import</button></div>`;
  }
  if (!st.gameId || !eventById(st.gameId)) st.gameId = defaultGameId();
  const game = eventById(st.gameId);
  const ups = signedUp(game.id);
  const lus = st.data.lineups.filter(l => l.event_id === game.id).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const t = todayIso();
  return `
    <div class="game-head">
      <div>
        <div class="when">${esc(fmtDate(game.date))}</div>
        <div class="facts">${esc(game.name)}${game.time_start ? `, Anpfiff ${esc(fmtTime(game.time_start))}` : ''}${game.time_meet ? `, Treffpunkt ${esc(fmtTime(game.time_meet))}` : ''}</div>
        <div class="facts">${ups.length} zugesagt</div>
      </div>
      <label class="field game-pick">Gegner (optional)
        <input class="input" data-on="opponent" value="${esc(game.opponent || '')}" placeholder="z.B. FC Beispiel" autocomplete="off"></label>
      <label class="field game-pick">Spiel
        <select class="select" data-on="game">${g.map(e =>
          `<option value="${e.id}" ${e.id === game.id ? 'selected' : ''}>${esc(fmtDate(e.date))}${e.time_start ? ', ' + esc(fmtTime(e.time_start)) : ''}${e.opponent ? ': ' + esc(e.opponent) : ''}${e.date < t ? ' (vorbei)' : ''}</option>`).join('')}</select>
      </label>
    </div>
    <div class="toolbar"><h2 class="grow">Aufstellungen</h2>
      <button class="btn primary" data-act="new-lineup">Neue Aufstellung</button></div>
    ${lus.length ? `<div class="lineup-list">${lus.map(l => `
      <article class="lu-card">
        <div>${miniPitch(l.data || {})}
          <h3>${esc(l.title || 'Ohne Titel')}</h3>
          <div class="small muted">${esc(l.data?.formation || '')}, ${(l.data?.slots || []).filter(Boolean).length}/11 besetzt</div>
          <div class="small muted">Von ${esc(emailName(l.created_by_email))}${l.updated_at ? `, geändert ${esc(fmtStamp(l.updated_at))}` : ''}${l.updated_by_email && l.updated_by_email !== l.created_by_email ? ` von ${esc(emailName(l.updated_by_email))}` : ''}</div>
        </div>
        <div class="row">
          <button class="btn small primary" data-act="open-lineup" data-id="${l.id}">Öffnen</button>
          <button class="btn small" data-act="dup-lineup" data-id="${l.id}">Duplizieren</button>
          <button class="btn small ghost danger" data-act="del-lineup" data-id="${l.id}">Löschen</button>
        </div>
      </article>`).join('')}</div>`
      : `<div class="panel empty"><p>Für dieses Spiel gibt es noch keine Aufstellung.</p></div>`}`;
}

function newDraft(game, base) {
  return {
    id: null, event_id: game.id,
    title: base ? `${base.title} (Kopie)` : `Aufstellung ${emailName(st.user.email)}`,
    data: base ? clone(base.data) : { formation: DEFAULT_FORMATION, slots: Array(11).fill(null), bench: [], extra: [] }
  };
}
function normalizeDraft(d) {
  d.data = d.data || {};
  if (!FORMATIONS[d.data.formation]) d.data.formation = DEFAULT_FORMATION;
  const s = Array.isArray(d.data.slots) ? d.data.slots.slice(0, 11) : [];
  while (s.length < 11) s.push(null);
  const known = id => (id && st.pmap.has(id) ? id : null);
  d.data.slots = s.map(known);
  d.data.bench = (d.data.bench || []).filter(known);
  d.data.extra = (d.data.extra || []).filter(known);
  return d;
}
function openDraft(d) {
  st.draft = normalizeDraft(d); st.dirty = !d.id; st.sel = null; st.pendingSlot = null; st.addSearch = '';
  renderView(); window.scrollTo(0, 0);
}
function leaveDraft() {
  if (st.dirty && !confirm('Die Aufstellung hat ungespeicherte Änderungen. Trotzdem verlassen?')) return false;
  st.draft = null; st.dirty = false; st.sel = null; st.pendingSlot = null;
  return true;
}

/* =========================================================================
   Aufstellung – Editor
   ========================================================================= */
function locate(pid) {
  const d = st.draft.data;
  const i = d.slots.indexOf(pid);
  if (i >= 0) return { type: 'slot', index: i };
  if (d.bench.includes(pid)) return { type: 'bench' };
  return { type: 'pool' };
}
function move(pid, target) {
  const d = st.draft.data;
  const src = locate(pid);
  if (target.type === 'slot' && d.slots[target.index] === pid) return;
  if (target.type === src.type && target.type !== 'slot') return;
  if (src.type === 'slot') d.slots[src.index] = null;
  if (src.type === 'bench') d.bench = d.bench.filter(x => x !== pid);
  if (target.type === 'slot') {
    const occ = d.slots[target.index];
    if (occ) { // tauschen
      if (src.type === 'slot') d.slots[src.index] = occ;
      else if (src.type === 'bench') d.bench.push(occ);
    }
    d.slots[target.index] = pid;
  } else if (target.type === 'bench') d.bench.push(pid);
  st.dirty = true;
}
function availableIds() {
  const ids = new Set(signedUp(st.draft.event_id).map(p => p.id));
  for (const id of st.draft.data.extra) ids.add(id);
  return ids;
}

function pitchLines() {
  return `<svg class="lines" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".4">
      <rect x="2" y="2" width="64" height="101"/>
      <line x1="2" y1="52.5" x2="66" y2="52.5"/>
      <circle cx="34" cy="52.5" r="9.15"/>
      <rect x="13.85" y="2" width="40.3" height="16.5"/><rect x="24.85" y="2" width="18.3" height="5.5"/>
      <rect x="13.85" y="86.5" width="40.3" height="16.5"/><rect x="24.85" y="97.5" width="18.3" height="5.5"/>
      <path d="M26.7 18.5 A9.15 9.15 0 0 0 41.3 18.5"/><path d="M26.7 86.5 A9.15 9.15 0 0 1 41.3 86.5"/>
    </g>
    <g fill="rgba(255,255,255,.55)"><circle cx="34" cy="52.5" r=".6"/><circle cx="34" cy="13" r=".5"/><circle cx="34" cy="92" r=".5"/></g>
  </svg>`;
}

function pcardHtml(p, info, opts = {}) {
  const cls = ['pcard'];
  if (st.sel === p.id) cls.push('sel');
  if (opts.fit) cls.push('fit');
  if (opts.dim) cls.push('dim');
  return `<div class="${cls.join(' ')}" draggable="true" data-act="pick" data-pid="${p.id}" tabindex="0">
    <div class="pc-main">
      <span class="pc-name">${esc(displayName(p))}</span>
      <span class="pc-sub">${posChips(p) || '<span>keine Position</span>'}
        ${roleBadge(p)}${outBadge(p, opts.date)}
        ${opts.comeback ? '<span class="badge cb">Comeback! 🎉</span>' : ''}
        ${p.is_guest ? '<span class="badge">Gast</span>' : ''}
        ${opts.extra ? '<span class="badge">hinzugefügt</span>' : ''}
        ${opts.gone ? '<span class="badge warn">nicht mehr zugesagt</span>' : ''}</span>
    </div>
    <div class="pc-att">${p.sp_user_id && countsForPresence(p) ? attHtml(info) : ''}</div>
    ${opts.extra ? `<button class="x" data-act="unextra" data-pid="${p.id}" title="Wieder entfernen" aria-label="${esc(displayName(p))} wieder entfernen">×</button>` : ''}
  </div>`;
}

function editorHtml() {
  const d = st.draft.data;
  const game = eventById(st.draft.event_id);
  const f = FORMATIONS[d.formation];
  const win = presenceWindow(game.date);
  const avail = availableIds();
  const placed = new Set([...d.slots.filter(Boolean), ...d.bench]);
  const selSlot = st.sel ? d.slots.indexOf(st.sel) : -1;
  const pendingPos = st.pendingSlot != null ? f[st.pendingSlot][0] : selSlot >= 0 ? f[selSlot][0] : null;
  const att = new Map();
  const getAtt = id => { if (!att.has(id)) att.set(id, attendance(id, win)); return att.get(id); };
  const cardOpts = p => ({ date: game.date, comeback: comeback(p, game), extra: d.extra.includes(p.id), gone: !avail.has(p.id) });

  const slotsHtml = f.map(([pos, x, y], i) => {
    const p = st.pmap.get(d.slots[i]);
    const cls = ['slot'];
    if (p) cls.push('filled');
    if (p && posTier(p, pos) === 2) cls.push('mismatch');
    if (p && st.sel === p.id) cls.push('sel');
    if (st.pendingSlot === i) cls.push('pending');
    if (p && !avail.has(p.id)) cls.push('gone');
    const info = p && countsForPresence(p) ? getAtt(p.id) : null;
    const title = p ? `${displayName(p)} auf ${POS_NAMES[pos]}${cls.includes('mismatch') ? ' (nicht seine Position)' : ''}` : `${POS_NAMES[pos]}: frei`;
    return `<div class="${cls.join(' ')}" style="left:${x}%;top:${y}%" data-act="slot" data-idx="${i}" ${p ? `draggable="true" data-pid="${p.id}"` : ''} title="${esc(title)}" role="button" tabindex="0">
      <div class="disc">${esc(pos)}</div>
      ${p ? `<div class="lbl">${esc(shortName(p))}${info && info.pct != null ? `<small>${info.pct}%</small>` : ''}</div>` : ''}
    </div>`;
  }).join('');

  const pool = [...avail].filter(id => !placed.has(id)).map(id => st.pmap.get(id)).filter(Boolean);
  const byAtt = (a, b) => (getAtt(b.id)?.pct ?? -1) - (getAtt(a.id)?.pct ?? -1) || byName(a, b);
  pool.sort(byAtt);
  let poolHtml;
  if (!pool.length) poolHtml = '<div class="zone-empty">Alle verfügbaren Spieler sind eingeteilt.</div>';
  else if (pendingPos) {
    const groups = [
      [`${POS_NAMES[pendingPos]}`, pool.filter(p => posTier(p, pendingPos) === 0)],
      [`Können auch ${pendingPos}`, pool.filter(p => posTier(p, pendingPos) === 1)],
      ['Übrige', pool.filter(p => posTier(p, pendingPos) !== 0 && posTier(p, pendingPos) !== 1)]
    ].filter(([, l]) => l.length);
    poolHtml = groups.map(([h, l], gi) => `<div class="grp-head">${esc(h)} (${l.length})</div>
      <div class="cards">${l.map(p => pcardHtml(p, getAtt(p.id), { ...cardOpts(p), fit: h !== 'Übrige', dim: h === 'Übrige' && posTier(p, pendingPos) === 2 })).join('')}</div>`).join('');
  } else {
    poolHtml = `<div class="cards">${pool.map(p => pcardHtml(p, getAtt(p.id), cardOpts(p))).join('')}</div>`;
  }
  const bench = d.bench.map(id => st.pmap.get(id)).filter(Boolean);
  const filled = d.slots.filter(Boolean).length;
  const staffChips = st.data.players
    .filter(p => p.active && (p.role === 'trainer' || p.role === 'spielertrainer') && !avail.has(p.id) && !placed.has(p.id))
    .sort(byName)
    .map(p => `<button class="chip small" data-act="add-staff" data-pid="${p.id}" title="${esc(displayName(p))} dazuholen">+ ${esc(shortName(p))}${outActive(p, game.date) ? ' ' + OUT_KINDS[p.out_kind].icon : ''}</button>`).join('');

  let hint = '<span>Ziehe Spieler aufs Feld, oder tippe zuerst eine Position an, um die passenden Spieler zu sehen.</span>';
  let hintActive = false;
  const cancelBtn = '<button class="btn small hint-cancel" data-act="clear-sel">✕ Abbrechen</button>';
  if (st.sel && selSlot >= 0) {
    hintActive = true;
    hint = `<span><strong>${esc(displayName(st.pmap.get(st.sel)))}</strong> (${esc(f[selSlot][0])}) ausgewählt. Tippe einen Ersatz an oder eine andere Position zum Tauschen.</span>${cancelBtn}`;
  } else if (st.sel) {
    hintActive = true;
    hint = `<span><strong>${esc(displayName(st.pmap.get(st.sel)))}</strong> ausgewählt. Tippe auf eine Position, die Ersatzbank oder die Liste.</span>${cancelBtn}`;
  } else if (pendingPos) {
    hintActive = true;
    hint = `<span>Wer spielt <strong>${esc(POS_NAMES[pendingPos])}</strong>? Die passenden Spieler stehen oben in der Liste.</span>${cancelBtn}`;
  }

  return `
    <div class="ed-top">
      <button class="btn ghost" data-act="back">‹ Alle Aufstellungen</button>
      <input class="input title-in" data-on="title" value="${esc(st.draft.title)}" aria-label="Titel der Aufstellung">
      <select class="select" data-on="formation" aria-label="Formation">${Object.keys(FORMATIONS).map(k =>
        `<option ${k === d.formation ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <button class="btn" data-act="export">Bild exportieren</button>
      <button class="btn primary" data-act="save" ${st.dirty ? '' : 'disabled'}>${st.dirty ? 'Speichern' : 'Gespeichert'}</button>
    </div>
    <div class="small muted" style="margin:-.4rem 0 .8rem">${esc(fmtDate(game.date))}${game.opponent ? ' gegen ' + esc(game.opponent) : ''}. ${filled}/11 auf dem Feld, ${bench.length} auf der Bank.</div>
    <div class="ed-body">
      <div>
        <div class="hint ${hintActive ? 'active' : ''}">${hint}</div>
        <div class="pitch">${pitchLines()}${slotsHtml}</div>
      </div>
      <aside class="side">
        <section class="zone bench ${st.sel && locate(st.sel).type !== 'bench' ? 'target' : ''}" data-act="zone" data-zone="bench" data-drop="bench">
          <div class="zone-head"><h3>Ersatzbank (${bench.length})</h3></div>
          ${bench.length ? `<div class="cards">${bench.map(p => pcardHtml(p, getAtt(p.id), cardOpts(p))).join('')}</div>`
            : '<div class="zone-empty">Ziehe Spieler hierher, die auf der Bank sitzen.</div>'}
        </section>
        <section class="zone pool ${st.sel && locate(st.sel).type !== 'pool' ? 'target' : ''}" data-act="zone" data-zone="pool" data-drop="pool">
          <div class="zone-head"><h3>Verfügbar (${pool.length})</h3>
            <button class="btn small" data-act="add-player">Spieler hinzufügen</button></div>
          ${staffChips ? `<div class="staff-row"><span class="small muted">Trainerteam:</span>${staffChips}</div>` : ''}
          <div style="margin-bottom:.6rem">${weekSeg()}</div>
          ${poolHtml}
        </section>
        <button class="btn ghost danger small" data-act="del-draft" ${st.draft.id ? '' : 'hidden'}>Diese Aufstellung löschen</button>
      </aside>
    </div>`;
}

function shareText() {
  const d = st.draft.data;
  const game = eventById(st.draft.event_id);
  const f = FORMATIONS[d.formation];
  const head = [TEAM, game.opponent ? `gegen ${game.opponent}` : '', fmtDate(game.date), game.time_start ? `Anpfiff ${fmtTime(game.time_start)}` : '', game.time_meet ? `Treffpunkt ${fmtTime(game.time_meet)}` : ''].filter(Boolean);
  const lines = [head.join(', '), `Formation ${d.formation}`, ''];
  const rows = []; let cur = null;
  f.forEach(([, , y], i) => { if (!cur || Math.abs(cur.y - y) > 8) { cur = { y, idx: [] }; rows.push(cur); } cur.idx.push(i); });
  for (const r of rows) lines.push(r.idx.map(i => `${f[i][0]}: ${st.pmap.get(d.slots[i]) ? displayName(st.pmap.get(d.slots[i])) : '–'}`).join(', '));
  if (d.bench.length) lines.push('', `Bank: ${d.bench.map(id => displayName(st.pmap.get(id))).join(', ')}`);
  return lines.join('\n');
}

/* =========================================================================
   Bild-Export (Canvas, ohne Prozente)
   ========================================================================= */
async function lineupCanvas(o) {
  try { await document.fonts?.ready; } catch { /* egal */ }
  const d = st.draft.data;
  const game = eventById(st.draft.event_id);
  const f = FORMATIONS[d.formation];
  const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const W = 1080, pad = 70, pw = W - 2 * pad, ph = Math.round(pw * 105 / 68);
  const sub = [];
  if (o.opp && game.opponent) sub.push(`gegen ${game.opponent}`);
  const meta = [];
  if (o.date) meta.push(fmtDate(game.date));
  if (o.time && game.time_start) meta.push(`Anpfiff ${fmtTime(game.time_start)}`);
  if (o.time && game.time_meet) meta.push(`Treffpunkt ${fmtTime(game.time_meet)}`);

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  // Ersatzbank vorab umbrechen
  ctx.font = `600 38px ${COND}`;
  const benchNames = d.bench.map(id => displayName(st.pmap.get(id)));
  const benchLines = [];
  if (benchNames.length) {
    let line = '';
    for (const n of benchNames) {
      const t = line ? `${line}, ${n}` : n;
      if (ctx.measureText(t).width > pw && line) { benchLines.push(line + ','); line = n; } else line = t;
    }
    benchLines.push(line);
  }
  let headH = 70 + 92 + (sub.length ? 64 : 0) + (meta.length ? 52 : 0) + 34;
  const benchH = benchLines.length ? 40 + 46 + benchLines.length * 48 : 0;
  c.width = W; c.height = headH + ph + benchH + pad;

  ctx.fillStyle = '#183322'; ctx.fillRect(0, 0, c.width, c.height);
  // Kopf
  let y = 70;
  ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
  ctx.font = `700 88px ${COND}`; ctx.fillText(TEAM, pad, y);
  ctx.textAlign = 'right'; ctx.font = `600 40px ${COND}`; ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText(d.formation, W - pad, y + 38);
  ctx.textAlign = 'left'; y += 92;
  if (sub.length) { ctx.font = `600 54px ${COND}`; ctx.fillStyle = '#e9c440'; ctx.fillText(sub[0], pad, y); y += 64; }
  if (meta.length) { ctx.font = `500 38px ${COND}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(meta.join('   '), pad, y); y += 52; }
  const top = headH;

  // Feld
  const r = 18;
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(pad, top, pw, ph, r) : ctx.rect(pad, top, pw, ph); ctx.clip();
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#2a6339' : '#2f6e41'; ctx.fillRect(pad, top + (ph * i) / 10, pw, ph / 10 + 1); }
  const sx = pw / 68, sy = ph / 105, X = v => pad + v * sx, Y = v => top + v * sy;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
  const rect = (x, yy, w, h) => ctx.strokeRect(X(x), Y(yy), w * sx, h * sy);
  rect(2, 2, 64, 101); rect(13.85, 2, 40.3, 16.5); rect(24.85, 2, 18.3, 5.5); rect(13.85, 86.5, 40.3, 16.5); rect(24.85, 97.5, 18.3, 5.5);
  ctx.beginPath(); ctx.moveTo(X(2), Y(52.5)); ctx.lineTo(X(66), Y(52.5)); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(X(34), Y(52.5), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Spieler
  ctx.textAlign = 'center';
  const R = 46;
  f.forEach(([pos, x, yy], i) => {
    const cx = pad + (x / 100) * pw, cy = top + (yy / 100) * ph;
    const p = st.pmap.get(d.slots[i]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    if (p) {
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowOffsetY = 4; ctx.shadowBlur = 6;
      ctx.fillStyle = '#f4f6ef'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1f3a27';
    } else {
      ctx.setLineDash([8, 7]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
    }
    ctx.textBaseline = 'middle'; ctx.font = `700 32px ${COND}`; ctx.fillText(pos, cx, cy + 1);
    if (p) {
      const name = shortName(p);
      let size = 40; ctx.font = `600 ${size}px ${COND}`;
      while (ctx.measureText(name).width > 230 && size > 24) { size -= 2; ctx.font = `600 ${size}px ${COND}`; }
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ffffff'; ctx.fillText(name, cx, cy + R + 8);
      ctx.shadowColor = 'transparent';
    }
  });

  // Ersatzbank
  if (benchLines.length) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let by = top + ph + 40;
    ctx.font = `700 40px ${COND}`; ctx.fillStyle = '#e9c440'; ctx.fillText('Ersatzbank', pad, by); by += 46;
    ctx.font = `600 38px ${COND}`; ctx.fillStyle = '#ffffff';
    for (const l of benchLines) { ctx.fillText(l, pad, by); by += 48; }
  }
  return c;
}

async function exportDialog() {
  const game = eventById(st.draft.event_id);
  const o = st.exportOpts;
  const canvas = await lineupCanvas(o);
  const url = canvas.toDataURL('image/png');
  const canShare = !!(navigator.canShare && navigator.share);
  openDialog(`
    <div class="dlg-head"><h2>Bild exportieren</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
    <div class="dlg-body">
      <div class="chips">
        <label class="check"><input type="checkbox" data-on="exp" data-k="opp" ${o.opp ? 'checked' : ''}><span>Gegner</span></label>
        <label class="check"><input type="checkbox" data-on="exp" data-k="date" ${o.date ? 'checked' : ''}><span>Datum</span></label>
        <label class="check"><input type="checkbox" data-on="exp" data-k="time" ${o.time ? 'checked' : ''}><span>Uhrzeit</span></label>
      </div>
      ${o.opp && !game.opponent ? `<label class="field">Gegner<input class="input" data-on="opponent-exp" placeholder="Gegner eintragen" autocomplete="off"></label>` : ''}
      <img class="export-preview" src="${url}" alt="Vorschau der Aufstellung als Bild">
    </div>
    <div class="dlg-foot">
      <button class="btn left" data-act="copy-text">Als Text kopieren</button>
      ${canShare ? '<button class="btn" data-act="share-img">Teilen</button>' : ''}
      <button class="btn primary" data-act="download-img">Herunterladen</button>
    </div>`);
}
const exportFileName = () => {
  const game = eventById(st.draft.event_id);
  return `aufstellung-${game.date}${game.opponent ? '-' + game.opponent.toLowerCase().replace(/[^a-z0-9äöü]+/g, '-') : ''}.png`;
};
const canvasBlob = c => new Promise(res => c.toBlob(res, 'image/png'));

/* =========================================================================
   Tab: Präsenz
   ========================================================================= */
function presenceHtml() {
  const today = todayIso();
  const win = presenceWindow(today);
  if (!win.weeks.length) {
    return `<div class="panel empty"><h2>Noch keine Trainingsdaten</h2>
      <p>Lade im Tab Import die Teilnahme-CSVs der Trainings hoch. Wer in einer Trainings-CSV steht, gilt als anwesend.</p>
      <button class="btn primary" data-act="tab" data-tab="import">Zum Import</button></div>`;
  }
  const base = st.data.players.filter(p => countsForPresence(p) && st.joined.has(p.id));
  const out = base.filter(p => outActive(p, today)).sort(byName);
  const rows = base.filter(p => !outActive(p, today)).map(p => ({ p, info: attendance(p.id, win) }))
    .sort((a, b) => (b.info?.pct ?? -1) - (a.info?.pct ?? -1) || byName(a.p, b.p));
  const first = win.weeks[win.weeks.length - 1];
  const held = win.sessions.filter(s => s.status === 'data').length;
  return `
    <div class="toolbar"><h2 class="grow">Trainingspräsenz</h2>${weekSeg()}</div>
    <p class="small muted" style="margin-top:-.5rem">${held} Trainings seit der Woche vom ${esc(fmtDate(first, false))}. Trainings derselben Woche zählen gleich, jüngere Wochen mehr als ältere. Wochen ohne Training werden übersprungen. Auf einen Spieler klicken, um seine Anwesenheit zu korrigieren.</p>
    ${win.missing.length ? `<div class="notice">Für ${win.missing.map(s => esc(fmtDate(s.date))).join(', ')} fehlen noch Daten. <button class="btn small" data-act="tab" data-tab="import">Importieren</button> <button class="btn small ghost" data-act="tab" data-tab="trainings">Training absagen</button></div>` : ''}
    <div class="table-wrap"><table class="list">
      <thead><tr><th>Spieler</th><th class="num">Präsenz</th><th>Verlauf (alt → neu)</th><th class="num">Anwesend</th></tr></thead>
      <tbody>${rows.map(({ p, info }) => `<tr class="click" data-act="att-player" data-id="${p.id}">
        <td class="name-cell"><strong>${esc(displayName(p))}</strong><span class="pc-sub">${posChips(p)}${roleBadge(p)}</span></td>
        <td class="num">${info?.pct != null ? `<span class="pct ${pctCls(info.pct)}">${info.pct}%</span>` : '<span class="muted">–</span>'}</td>
        <td>${dotsHtml(info)}</td>
        <td class="num small muted">${info ? `${info.count}/${info.total}` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="legend small muted"><span class="dot on"></span> dabei <span class="dot off"></span> nicht dabei <span class="dot cancel"></span> abgesagt <span class="dot neutral"></span> zählt nicht <span class="dot missing"></span> Daten fehlen <span class="dot on man"></span> von Hand</p>
    <div class="section"><div class="toolbar"><h2 class="grow">Ausser Gefecht</h2><button class="btn" data-act="out-new">Jemanden ausser Gefecht melden</button></div>
      ${out.length ? `<div class="out-list">${out.map(p => {
        const k = OUT_KINDS[p.out_kind];
        return `<div class="out-card" data-act="out-edit" data-id="${p.id}" role="button" tabindex="0" title="Bearbeiten">
          <span class="out-icon" aria-hidden="true">${k.icon}</span>
          <div><strong>${esc(displayName(p))}</strong>
            <div class="small muted">${esc(p.out_title || k.label)}, seit ${esc(fmtDate(p.out_from, false))}${p.out_until ? `. Comeback geplant am ${esc(fmtDate(p.out_until, false))}` : ''}</div></div>
          <button class="btn small" data-act="fit-again" data-id="${p.id}">Wieder fit</button>
        </div>`;
      }).join('')}</div>
      <p class="small muted">Während dieser Zeit zählen die Trainings für diese Personen nicht.</p>` : '<p class="muted">Alle an Bord. Verletzte oder Leute mit Sonderaufgabe hier melden, dann zählt ihre Präsenz in dieser Zeit nicht.</p>'}
    </div>`;
}

function outDialog(pid) {
  const today = todayIso();
  const p = pid ? st.pmap.get(pid) : null;
  const act = p && outActive(p, today);
  const kind = act ? p.out_kind : 'lazarett';
  const cands = st.data.players.filter(x => x.active && !x.is_guest && !outActive(x, today)).sort(byName);
  openDialog(`
    <form method="dialog" data-form="out" data-id="${p ? p.id : ''}">
      <div class="dlg-head"><h2>${p ? esc(displayName(p)) + ' ausser Gefecht' : 'Ausser Gefecht melden'}</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
      <div class="dlg-body">
        ${p ? '' : `<label class="field">Wer?<select class="select" name="pid" required><option value="">Person wählen</option>${cands.map(x => `<option value="${x.id}">${esc(displayName(x))}</option>`).join('')}</select></label>`}
        <div class="field">Grund
          <div class="kind-pick">${Object.entries(OUT_KINDS).map(([k, v]) => `<label class="kind-opt"><input type="radio" name="out_kind" value="${k}" data-on="outkind" ${kind === k ? 'checked' : ''}><span class="kind-icon" aria-hidden="true">${v.icon}</span><span>${v.label}</span></label>`).join('')}</div></div>
        <label class="field">Titel (optional)
          <input class="input" name="out_title" value="${esc(act ? p.out_title : '')}" placeholder="${kind === 'sonder' ? 'z.B. Fitnesscoach, Kassier' : 'z.B. Knie, Muskelfaserriss'}" autocomplete="off"></label>
        <div class="grid2">
          <label class="field">Seit<input class="input" type="date" name="out_from" value="${esc(act ? p.out_from : today)}" required></label>
          <label class="field">Comeback (optional)<input class="input" type="date" name="out_until" value="${esc(act ? p.out_until || '' : '')}"></label>
        </div>
        <p class="small muted" style="margin:0">Trainings in dieser Zeit zählen nicht für die Präsenz. Ab dem Comeback-Datum ist die Person automatisch wieder dabei.</p>
        <p class="error" hidden></p>
      </div>
      <div class="dlg-foot">
        ${act ? `<button type="button" class="btn left" data-act="fit-again" data-id="${p.id}">Wieder fit 💪</button>` : ''}
        <button type="button" class="btn" data-act="close">Abbrechen</button>
        <button type="submit" class="btn primary">Speichern</button>
      </div>
    </form>`);
}

function attendanceDialog(pid) {
  const p = st.pmap.get(pid);
  const today = todayIso();
  const list = st.sessions.filter(s => s.date <= today && s.status !== 'future').slice(0, 24);
  openDialog(`
    <div class="dlg-head"><h2>${esc(displayName(p))}</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
    <div class="dlg-body">
      <p class="small muted" style="margin:0">Häkchen = war im Training. Änderungen werden sofort gespeichert und haben Vorrang vor späteren Imports.</p>
      <div class="att-list">${list.map(s => {
        const label = `<span class="att-date">${esc(fmtDate(s.date))}</span>`;
        if (s.status === 'cancelled') return `<div class="att-row muted">${label}<span class="small">${s.game && !s.cancelled ? 'Spiel statt Training' : 'abgesagt'}</span></div>`;
        const nr = neutralReason(p, s.date);
        const checked = s.event ? isPresent(s.event.id, pid) : false;
        const man = s.event && isManual(s.event.id, pid);
        return `<label class="att-row">${label}
          <span class="small muted">${s.status === 'missing' ? 'keine Daten' : ''}${nr ? esc(nr) : ''}${man ? '<span class="badge">von Hand</span>' : ''}</span>
          <input type="checkbox" data-on="att" data-pid="${pid}" data-date="${s.date}" ${checked ? 'checked' : ''}>
          ${man ? `<button type="button" class="btn small ghost" data-act="att-reset" data-pid="${pid}" data-date="${s.date}" title="Wieder den importierten Wert verwenden">Zurücksetzen</button>` : '<span></span>'}
        </label>`;
      }).join('') || '<div class="zone-empty">Noch keine Trainings.</div>'}</div>
    </div>
    <div class="dlg-foot"><button class="btn left" data-act="edit-player" data-id="${pid}">Spielerdaten bearbeiten</button><button class="btn primary" data-act="close">Fertig</button></div>`);
}

async function ensureTrainingEvent(date) {
  const s = sessionByDate(date);
  if (s?.event) return s.event;
  return api.upsertEvent({ sp_key: `training|${date}`, kind: 'training', name: 'Training', date });
}
async function setAttendance(date, pid, present) {
  const ev = await ensureTrainingEvent(date);
  const imported = st.part.get(ev.id)?.get(pid) === 'yes';
  await api.setOverride(ev.id, pid, present === imported && st.part.has(ev.id) ? null : present);
  await reload();
}

/* =========================================================================
   Tab: Trainings (Plan, Absagen, Anwesenheit pro Training)
   ========================================================================= */
function trainingsHtml() {
  const today = todayIso();
  const periods = [...st.data.training_periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const limit = isoAdd(today, -7 * 10);
  const list = st.sessions.filter(s => s.date <= isoAdd(today, 21) && (st.showOld || s.date >= limit));
  const statusTxt = s => {
    if (s.status === 'cancelled') return s.game && !s.cancelled ? 'Spiel statt Training' : 'abgesagt';
    if (s.status === 'missing') return 'Daten fehlen';
    if (s.status === 'future') return 'geplant';
    if (!st.part.has(s.event.id)) return 'von Hand erfasst';
    return s.planned ? 'Daten vorhanden' : 'Zusatztraining';
  };
  const presentCount = s => (s.event ? st.data.players.filter(p => isPresent(s.event.id, p.id)).length : '');
  return `
    <div class="toolbar"><h2 class="grow">Trainingsplan</h2><button class="btn primary" data-act="new-period">Zeitraum hinzufügen</button></div>
    ${periods.length ? `<div class="table-wrap"><table class="list">
      <thead><tr><th>Von</th><th>Bis</th><th>Trainingstage</th><th></th></tr></thead>
      <tbody>${periods.map(p => `<tr><td>${esc(fmtDate(p.start_date))}</td><td>${esc(fmtDate(p.end_date))}</td>
        <td>${(p.weekdays || []).slice().sort().map(i => WEEKDAYS[i]).join(', ') || '–'}</td>
        <td class="num"><button class="btn small" data-act="edit-period" data-id="${p.id}">Bearbeiten</button>
          <button class="btn small ghost danger" data-act="del-period" data-id="${p.id}">Löschen</button></td></tr>`).join('')}</tbody>
    </table></div>`
      : '<div class="panel empty"><p>Noch kein Trainingsplan. Ohne Plan zählen nur die importierten Trainings.</p></div>'}
    <div class="section">
      <div class="toolbar"><h2 class="grow">Trainings</h2>
        <button class="btn small ghost" data-act="toggle-old">${st.showOld ? 'Nur letzte 10 Wochen' : 'Ältere anzeigen'}</button></div>
      ${list.length ? `<div class="table-wrap"><table class="list">
        <thead><tr><th>Datum</th><th>Status</th><th class="num">Anwesend</th><th></th></tr></thead>
        <tbody>${list.map(s => `<tr class="${s.status === 'cancelled' ? 'cancelled' : ''}">
          <td>${esc(fmtDate(s.date))}</td>
          <td><span class="st-${s.status}">${esc(statusTxt(s))}</span></td>
          <td class="num">${s.status === 'data' ? presentCount(s) : ''}</td>
          <td class="num">
            ${s.status === 'data' || s.status === 'missing' ? `<button class="btn small" data-act="session" data-date="${s.date}">Anwesenheit</button>` : ''}
            ${s.game && !s.cancelled ? '' : s.status === 'cancelled' ? `<button class="btn small ghost" data-act="uncancel" data-date="${s.date}">Wieder ansetzen</button>`
              : `<button class="btn small ghost" data-act="cancel" data-date="${s.date}">Absagen</button>`}
          </td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">Keine Trainings in diesem Zeitraum.</p>'}
    </div>`;
}

function periodDialog(p) {
  const days = new Set(p.weekdays || []);
  openDialog(`
    <form method="dialog" data-form="period" data-id="${p.id || ''}">
      <div class="dlg-head"><h2>${p.id ? 'Zeitraum bearbeiten' : 'Zeitraum hinzufügen'}</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
      <div class="dlg-body">
        <div class="grid2">
          <label class="field">Von<input class="input" type="date" name="start_date" value="${esc(p.start_date || '')}" required></label>
          <label class="field">Bis<input class="input" type="date" name="end_date" value="${esc(p.end_date || '')}" required></label>
        </div>
        <div class="field">Trainingstage
          <div class="chips">${WEEKDAYS.map((w, i) => `<button type="button" class="chip" data-act="chip" data-day="${i}" aria-pressed="${days.has(i)}">${w}</button>`).join('')}</div></div>
        <p class="error" hidden></p>
      </div>
      <div class="dlg-foot"><button type="button" class="btn" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div>
    </form>`);
}

function sessionDialog(date) {
  const s = sessionByDate(date);
  const players = st.data.players.filter(p => p.active && !p.is_guest && st.joined.has(p.id)).sort(byName);
  openDialog(`
    <div class="dlg-head"><h2>Training ${esc(fmtDate(date))}</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
    <div class="dlg-body">
      <p class="small muted" style="margin:0">Häkchen = war im Training. Änderungen werden sofort gespeichert.</p>
      <div class="att-list">${players.map(p => {
        const ck = s?.event ? isPresent(s.event.id, p.id) : false;
        const man = s?.event && isManual(s.event.id, p.id);
        return `<label class="att-row"><span class="att-date">${esc(displayName(p))}</span>
          <span class="small muted">${outActive(p, date) ? OUT_KINDS[p.out_kind].icon + ' ausser Gefecht' : ''}${man ? '<span class="badge">von Hand</span>' : ''}</span>
          <input type="checkbox" data-on="att" data-pid="${p.id}" data-date="${date}" ${ck ? 'checked' : ''}><span></span></label>`;
      }).join('')}</div>
    </div>
    <div class="dlg-foot"><button class="btn ghost left" data-act="cancel" data-date="${date}">Training absagen</button><button class="btn primary" data-act="close">Fertig</button></div>`);
}

/* =========================================================================
   Tab: Spieler
   ========================================================================= */
function playersHtml() {
  const today = todayIso();
  const filters = [['kader', 'Kader'], ['staff', 'Trainerteam'], ['out', 'Ausser Gefecht'], ['guest', 'Gäste'], ['inactive', 'Nicht im Kader'], ['all', 'Alle']];
  const q = st.pSearch.trim().toLowerCase();
  const win = presenceWindow(today);
  const list = st.data.players.filter(p => {
    if (st.pFilter === 'kader' && !(p.active && !p.is_guest)) return false;
    if (st.pFilter === 'staff' && !(p.role === 'trainer' || p.role === 'spielertrainer')) return false;
    if (st.pFilter === 'out' && !outActive(p, today)) return false;
    if (st.pFilter === 'guest' && !p.is_guest) return false;
    if (st.pFilter === 'inactive' && p.active) return false;
    if (q && ![p.first_name, p.last_name, p.nickname, p.sp_name].join(' ').toLowerCase().includes(q)) return false;
    return true;
  }).sort(byName);
  return `
    <div class="toolbar">
      <input class="input grow" type="search" placeholder="Suchen" data-on="psearch" value="${esc(st.pSearch)}" aria-label="Spieler suchen">
      ${st.pFilter === 'out' ? '<button class="btn" data-act="out-new">Ausser Gefecht melden</button>' : ''}
      <button class="btn primary" data-act="new-player">Spieler erfassen</button>
    </div>
    <div class="toolbar"><span class="seg wrap" role="group" aria-label="Filter">${filters.map(([k, l]) =>
      `<button type="button" data-act="pfilter" data-f="${k}" aria-pressed="${st.pFilter === k}">${l}</button>`).join('')}</span></div>
    ${list.length ? `<div class="table-wrap"><table class="list">
      <thead><tr><th>Name</th><th>Positionen</th><th>SpielerPlus</th><th class="num">Präsenz</th></tr></thead>
      <tbody>${list.map(p => {
        const info = countsForPresence(p) && !outActive(p, today) ? attendance(p.id, win) : null;
        return `<tr class="click" data-act="edit-player" data-id="${p.id}">
          <td class="name-cell"><strong>${esc(displayName(p))}</strong>${p.nickname && fullName(p) !== p.nickname ? `<span class="small muted">${esc(fullName(p))}</span>` : ''}
            <span class="pc-sub">${roleBadge(p)}${outBadge(p, today)}${p.is_guest ? '<span class="badge">Gast</span>' : ''}${!p.active ? '<span class="badge">nicht im Kader</span>' : ''}</span></td>
          <td><span class="pc-sub">${posChips(p) || '<span class="badge warn">fehlt</span>'}</span></td>
          <td class="small muted">${esc(p.sp_name || '–')}</td>
          <td class="num">${info?.pct != null ? `<span class="pct ${pctCls(info.pct)}">${info.pct}%</span>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>`
      : `<div class="panel empty"><p>${st.data.players.length ? 'Keine Personen in dieser Ansicht.' : 'Noch keine Spieler. Sie entstehen automatisch beim ersten Import einer CSV.'}</p></div>`}`;
}

/* =========================================================================
   Dialoge
   ========================================================================= */
const dlg = () => $('#dlg');
function openDialog(html) { const d = dlg(); d.innerHTML = html; if (!d.open) d.showModal(); }
function closeDialog() { const d = dlg(); if (d.open) d.close(); }

function playerDialog(p, opts = {}) {
  const isNew = !p.id;
  const pos = new Set(p.positions || []);
  const today = todayIso();
  openDialog(`
    <form method="dialog" data-form="player" data-id="${p.id || ''}" data-guest-for-draft="${opts.forDraft ? '1' : ''}">
      <div class="dlg-head"><h2>${isNew ? (p.is_guest ? 'Gastspieler erfassen' : 'Spieler erfassen') : esc(displayName(p))}</h2>
        <button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
      <div class="dlg-body">
        ${p.sp_name ? `<div class="small muted">In SpielerPlus: ${esc(p.sp_name)}${p.sp_roles ? ` (${esc(p.sp_roles)})` : ''}</div>` : ''}
        <div class="grid2">
          <label class="field">Vorname<input class="input" name="first_name" value="${esc(p.first_name)}" autocomplete="off"></label>
          <label class="field">Nachname<input class="input" name="last_name" value="${esc(p.last_name)}" autocomplete="off"></label>
        </div>
        <label class="field">Spitzname <span class="small muted" style="font-weight:400">wird in der Aufstellung angezeigt, falls ausgefüllt</span>
          <input class="input" name="nickname" value="${esc(p.nickname)}" autocomplete="off"></label>
        <div class="field">Positionen
          <div class="chips">${POSITIONS.map(x => `<button type="button" class="chip" data-act="chip" data-pos="${x}" aria-pressed="${pos.has(x)}" title="${esc(POS_NAMES[x])}">${x}</button>`).join('')}</div>
        </div>
        ${opts.forDraft ? '' : `
        <label class="field">Rolle
          <select class="select" name="role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="small muted" style="font-weight:400">Bei «Trainer» spielt die Präsenz keine Rolle.</span></label>
        <label class="check"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span>Im Kader</span></label>
        <label class="check"><input type="checkbox" name="is_guest" ${p.is_guest ? 'checked' : ''}><span>Gastspieler</span></label>`}
        <p class="error" hidden></p>
      </div>
      <div class="dlg-foot">
        ${!isNew ? `<button type="button" class="btn ghost danger left" data-act="del-player" data-id="${p.id}">Löschen</button>` : ''}
        <button type="button" class="btn" data-act="close">Abbrechen</button>
        <button type="submit" class="btn primary">${opts.forDraft ? 'Erfassen und hinzufügen' : 'Speichern'}</button>
      </div>
    </form>`);
}

function addPlayerDialog() {
  const avail = availableIds();
  const placed = new Set([...st.draft.data.slots.filter(Boolean), ...st.draft.data.bench]);
  const q = st.addSearch.trim().toLowerCase();
  const game = eventById(st.draft.event_id);
  const win = presenceWindow(game.date);
  const statusTxt = { no: 'abgesagt', unsure: 'unsicher', absence: 'Absence', none: 'keine Antwort' };
  const gs = st.part.get(game.id) || new Map();
  const list = st.data.players.filter(p => !avail.has(p.id) && !placed.has(p.id) && (p.active || p.is_guest))
    .filter(p => !q || [p.first_name, p.last_name, p.nickname, p.sp_name].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (a.is_guest - b.is_guest) || byName(a, b));
  openDialog(`
    <div class="dlg-head"><h2>Spieler hinzufügen</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
    <div class="dlg-body">
      <p class="small muted" style="margin:0">Alle, die für dieses Spiel nicht zugesagt haben, inklusive Gäste.</p>
      <input class="input" type="search" placeholder="Suchen" data-on="addsearch" value="${esc(st.addSearch)}" aria-label="Suchen">
      <div class="pick-list">${list.length ? list.map(p => `<div class="pcard" data-act="add-extra" data-pid="${p.id}" tabindex="0" role="button">
          <div class="pc-main"><span class="pc-name">${esc(displayName(p))}</span>
            <span class="pc-sub">${posChips(p)}${roleBadge(p)}${outBadge(p, game.date)}${p.is_guest ? '<span class="badge">Gast</span>' : ''}${gs.has(p.id) ? `<span class="badge">${statusTxt[gs.get(p.id)] || ''}</span>` : ''}</span></div>
          <div class="pc-att">${p.sp_user_id && countsForPresence(p) ? attHtml(attendance(p.id, win)) : ''}</div></div>`).join('') : '<div class="zone-empty">Niemand gefunden.</div>'}</div>
    </div>
    <div class="dlg-foot"><button class="btn left" data-act="new-guest">Neuen Gastspieler erfassen</button><button class="btn" data-act="close">Fertig</button></div>`);
}

function passwordDialog() {
  openDialog(`
    <form method="dialog" data-form="pw">
      <div class="dlg-head"><h2>Passwort ändern</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
      <div class="dlg-body">
        <label class="field">Neues Passwort<input class="input" type="password" name="pw" minlength="8" required autocomplete="new-password"></label>
        <label class="field">Wiederholen<input class="input" type="password" name="pw2" minlength="8" required autocomplete="new-password"></label>
        <p class="error" hidden></p>
      </div>
      <div class="dlg-foot"><button type="button" class="btn" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Passwort ändern</button></div>
    </form>`);
}

function textDialog(text) {
  openDialog(`
    <div class="dlg-head"><h2>Aufstellung als Text</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
    <div class="dlg-body"><p class="small muted" style="margin:0">Kopieren und z.B. im Team-Chat einfügen.</p><textarea class="share" readonly>${esc(text)}</textarea></div>
    <div class="dlg-foot"><button class="btn" data-act="close">Schliessen</button></div>`);
  const ta = $('textarea', dlg()); ta.focus(); ta.select();
}

/* =========================================================================
   Tab: Import (Termin-CSV und Statistik-CSV)
   ========================================================================= */
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field); if (row.some(x => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
function spDate(s) {
  const m = /^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})$/.exec(s || '');
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;
}
const STATUS_MAP = { STATUS_CONFIRMED: 'yes', STATUS_REJECTED: 'no', STATUS_UNSURE: 'unsure', STATUS_ABSENCE: 'absence', STATUS_NOT_CHOOSED: 'none' };
const TYPE_MAP = { training: 'training', game: 'spiel', tournament: 'spiel', event: 'ignore' };

async function handleFiles(files) {
  const evMap = new Map(); const problems = [];
  for (const file of files) {
    let rows;
    try { rows = parseCsv(await file.text()); } catch { problems.push(`${file.name}: konnte nicht gelesen werden.`); continue; }
    const stats = rows.length && 'user_participation' in rows[0];
    if (!rows.length || !('user_id' in rows[0]) || !('event_date_start' in rows[0])) {
      problems.push(`${file.name}: sieht nicht wie ein Export aus SpielerPlus aus.`); continue;
    }
    for (const r of rows) {
      const date = spDate(r.event_date_start);
      if (!date || !r.user_id) continue;
      const kind = stats ? (TYPE_MAP[r.event_type] || 'ignore') : (/train/i.test(r.event_name) ? 'training' : 'spiel');
      const gkey = `${stats ? r.event_type : kind}|${date}|${r.event_name}`;
      if (!evMap.has(gkey)) {
        evMap.set(gkey, {
          source: stats ? 'Statistik' : 'Termin', team_name: r.team_name || '', name: r.event_name || 'Termin', date,
          time_start: stats ? null : r.event_time_start || '', time_meet: stats ? null : r.event_time_meet || '',
          kind, include: kind !== 'ignore', people: new Map()
        });
      }
      evMap.get(gkey).people.set(r.user_id, {
        sp_user_id: r.user_id, sp_name: r.user_name || '', sp_roles: stats ? null : r.user_roles || '',
        status: stats ? (STATUS_MAP[r.user_participation] || 'none') : 'yes'
      });
    }
  }
  const events = [...evMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  st.preview = { events, problems };
  renderView();
}
const previewExisting = e => st.data.events.find(x => x.sp_key === `${e.kind}|${e.date}`);

async function runImport() {
  const evs = st.preview.events.filter(e => e.include && e.kind !== 'ignore');
  if (!evs.length) return;
  st.busy = true; renderView();
  try {
    const bySp = new Map(st.data.players.filter(p => p.sp_user_id).map(p => [p.sp_user_id, p]));
    const seen = new Map();
    for (const e of evs) for (const person of e.people.values()) {
      const prev = seen.get(person.sp_user_id);
      seen.set(person.sp_user_id, { ...person, sp_roles: person.sp_roles ?? prev?.sp_roles ?? null });
    }
    const fresh = [];
    for (const [spId, person] of seen) {
      if (bySp.has(spId)) continue;
      const parts = person.sp_name.trim().split(/\s+/);
      fresh.push({ sp_user_id: spId, sp_name: person.sp_name, sp_roles: person.sp_roles || '', first_name: parts[0] || '', last_name: parts.slice(1).join(' '), ...(INITIAL[spId] || {}) });
    }
    const inserted = await api.insertPlayers(fresh);
    for (const p of inserted) bySp.set(p.sp_user_id, p);
    for (const [spId, person] of seen) {
      const p = bySp.get(spId);
      if (!p || fresh.some(x => x.sp_user_id === spId)) continue;
      const upd = {};
      if (p.sp_name !== person.sp_name) upd.sp_name = person.sp_name;
      if (person.sp_roles != null && p.sp_roles !== person.sp_roles) upd.sp_roles = person.sp_roles;
      if (Object.keys(upd).length) await api.savePlayer({ id: p.id, ...upd });
    }
    for (const e of evs) {
      const ev = { sp_key: `${e.kind}|${e.date}`, kind: e.kind, team_name: e.team_name, name: e.name, date: e.date };
      if (e.time_start != null) { ev.time_start = e.time_start; ev.time_meet = e.time_meet; }
      const saved = await api.upsertEvent(ev);
      await api.setParticipations(saved.id, [...e.people.values()]
        .map(x => ({ player_id: bySp.get(x.sp_user_id)?.id, status: x.status })).filter(x => x.player_id));
    }
    await reload();
    st.preview = null;
    toast(`${evs.length} Termin${evs.length === 1 ? '' : 'e'} importiert${fresh.length ? `, ${fresh.length} neue Personen` : ''}.`);
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err.message}`);
  } finally { st.busy = false; renderView(); }
}

function importHtml() {
  const pv = st.preview;
  const evs = [...st.data.events].sort((a, b) => b.date.localeCompare(a.date));
  const n = pv ? pv.events.filter(e => e.include && e.kind !== 'ignore').length : 0;
  const yes = e => [...e.people.values()].filter(x => x.status === 'yes').length;
  return `
    <h2 style="margin-bottom:.75rem">CSV aus SpielerPlus importieren</h2>
    <label class="drop" data-drop="files">
      <strong>CSV-Dateien hier ablegen oder auswählen</strong>
      <span class="small muted">Termin-Export (wöchentlich) oder Statistik-Export (gelegentlich, mit Absagen). Mehrere Dateien gehen auch. Ein bereits importierter Termin wird mit dem neuen Stand ersetzt; von Hand gesetzte Häkchen bleiben erhalten.</span>
      <input type="file" accept=".csv,text/csv" multiple data-on="files" style="position:absolute;opacity:0;width:1px;height:1px">
    </label>
    ${pv ? `<div class="section">
      ${pv.problems.map(p => `<p class="error">${esc(p)}</p>`).join('')}
      ${pv.events.length ? `
      <div class="toolbar"><h2 class="grow">Vorschau</h2>
        <button class="btn primary" data-act="do-import" ${st.busy || !n ? 'disabled' : ''}>${st.busy ? 'Importiere …' : `${n} Termine importieren`}</button>
        <button class="btn ghost" data-act="cancel-import">Verwerfen</button></div>
      <p class="small muted" style="margin-top:-.5rem">Prüfe, ob Training und Spiel richtig erkannt wurden.</p>
      <div class="table-wrap"><table class="list">
        <thead><tr><th></th><th>Datum</th><th>Termin</th><th>Art</th><th class="num">Zusagen</th><th>Quelle</th><th>Status</th></tr></thead>
        <tbody>${pv.events.map((e, i) => {
          const ex = previewExisting(e);
          return `<tr>
          <td><input type="checkbox" data-on="pv-include" data-i="${i}" ${e.include ? 'checked' : ''} aria-label="Importieren"></td>
          <td>${esc(fmtDate(e.date))}${e.time_start ? `<br><span class="small muted">${esc(fmtTime(e.time_start))}</span>` : ''}</td>
          <td>${esc(e.name)}</td>
          <td><select class="select" data-on="pv-kind" data-i="${i}" style="min-width:120px">
            <option value="training" ${e.kind === 'training' ? 'selected' : ''}>Training</option>
            <option value="spiel" ${e.kind === 'spiel' ? 'selected' : ''}>Spiel</option>
            <option value="ignore" ${e.kind === 'ignore' ? 'selected' : ''}>Ignorieren</option></select></td>
          <td class="num">${yes(e)}${e.source === 'Statistik' ? ` / ${e.people.size}` : ''}</td>
          <td class="small">${e.source}</td>
          <td class="small">${e.kind === 'ignore' ? '–' : ex ? 'ersetzt bisherigen Stand' : 'neu'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>` : ''}
    </div>` : ''}
    <div class="section"><h2>Importierte Termine</h2>
      ${evs.length ? `<div class="table-wrap"><table class="list">
        <thead><tr><th>Datum</th><th>Termin</th><th>Art</th><th class="num">Zusagen</th><th></th></tr></thead>
        <tbody>${evs.map(e => `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.opponent ? `${e.name} gegen ${e.opponent}` : e.name)}</td><td>${e.kind === 'training' ? 'Training' : 'Spiel'}</td>
          <td class="num">${[...(st.part.get(e.id) || new Map()).values()].filter(s => s === 'yes').length}</td>
          <td class="num"><button class="btn small ghost danger" data-act="del-event" data-id="${e.id}">Löschen</button></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">Noch nichts importiert.</p>'}
    </div>`;
}

/* =========================================================================
   Ereignisse
   ========================================================================= */
async function guarded(fn) {
  try { await fn(); } catch (err) { console.error(err); alert(`Das hat nicht geklappt: ${err.message}`); }
}
function refreshDialogAfter(fn) {
  return async el => {
    await fn(el);
    const d = dlg().dataset;
    if (dlg().open && d.kind === 'att-player') attendanceDialog(d.ref);
    else if (dlg().open && d.kind === 'session') sessionDialog(d.ref);
    renderView();
  };
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const H = actions[el.dataset.act];
  if (H) { e.preventDefault(); guarded(() => H(el, e)); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (st.sel || st.pendingSlot != null) && !dlg().open) { st.sel = null; st.pendingSlot = null; renderView(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act="pick"],[data-act="slot"],[data-act="add-extra"],.out-card')) {
    e.preventDefault(); e.target.click();
  }
});

const setDlgKind = (kind, ref) => { dlg().dataset.kind = kind; dlg().dataset.ref = ref; };

const actions = {
  tab(el) {
    const t = el.dataset.tab;
    closeDialog();
    if (st.tab === 'lineup' && st.draft && t !== 'lineup' && !leaveDraft()) return;
    st.tab = t; renderView(); window.scrollTo(0, 0);
  },
  async logout() {
    if (st.draft && !leaveDraft()) return;
    await api.signOut(); location.reload();
  },
  pw() { setDlgKind('', ''); passwordDialog(); },
  close() { closeDialog(); renderView(); },
  nweeks(el) { st.nWeeks = +el.dataset.n; lsSet('nWeeks', st.nWeeks); renderView(); },

  // Aufstellungen
  'new-lineup'() { openDraft(newDraft(eventById(st.gameId))); },
  'open-lineup'(el) { openDraft(clone(st.data.lineups.find(x => x.id === el.dataset.id))); },
  'dup-lineup'(el) { const l = st.data.lineups.find(x => x.id === el.dataset.id); openDraft(newDraft(eventById(l.event_id), l)); },
  async 'del-lineup'(el) {
    const l = st.data.lineups.find(x => x.id === el.dataset.id);
    if (!confirm(`«${l.title}» löschen?`)) return;
    await api.deleteLineup(l.id); await reload(); renderView(); toast('Aufstellung gelöscht.');
  },
  async 'del-draft'() {
    if (!confirm(`«${st.draft.title}» löschen?`)) return;
    await api.deleteLineup(st.draft.id); st.dirty = false; st.draft = null; await reload(); renderView(); toast('Aufstellung gelöscht.');
  },
  back() { if (leaveDraft()) renderView(); },
  async save(el) {
    el.disabled = true; el.textContent = 'Speichere …';
    const saved = await api.saveLineup(st.draft);
    st.draft.id = saved.id; st.dirty = false;
    await reload();
    renderView(); toast('Aufstellung gespeichert.');
  },
  export() { setDlgKind('export', ''); return exportDialog(); },
  async 'copy-text'() {
    const text = shareText();
    try { await navigator.clipboard.writeText(text); toast('Aufstellung als Text kopiert.'); }
    catch { textDialog(text); }
  },
  async 'download-img'() {
    const blob = await canvasBlob(await lineupCanvas(st.exportOpts));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = exportFileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  async 'share-img'() {
    const blob = await canvasBlob(await lineupCanvas(st.exportOpts));
    const file = new File([blob], exportFileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Aufstellung' }); } catch (err) { if (err.name !== 'AbortError') throw err; }
    } else toast('Teilen wird hier nicht unterstützt. Bitte herunterladen.');
  },
  'clear-sel'() { st.sel = null; st.pendingSlot = null; renderView(); },
  pick(el) {
    const pid = el.dataset.pid;
    const selSlot = st.sel && st.sel !== pid ? st.draft.data.slots.indexOf(st.sel) : -1;
    if (st.pendingSlot != null) { move(pid, { type: 'slot', index: st.pendingSlot }); st.pendingSlot = null; st.sel = null; }
    else if (selSlot >= 0) { move(pid, { type: 'slot', index: selSlot }); st.sel = null; } // Ersatz für den gewählten Feldspieler
    else st.sel = st.sel === pid ? null : pid;
    renderView();
  },
  slot(el) {
    const i = +el.dataset.idx;
    const occ = st.draft.data.slots[i];
    if (st.sel) { if (st.sel !== occ) move(st.sel, { type: 'slot', index: i }); st.sel = null; }
    else if (occ) { st.sel = occ; st.pendingSlot = null; }
    else st.pendingSlot = st.pendingSlot === i ? null : i;
    renderView();
  },
  zone(el) {
    if (!st.sel) return;
    move(st.sel, { type: el.dataset.zone }); st.sel = null; renderView();
  },
  'add-player'() { st.addSearch = ''; setDlgKind('add', ''); addPlayerDialog(); },
  'add-staff'(el) {
    const pid = el.dataset.pid;
    if (!st.draft.data.extra.includes(pid)) st.draft.data.extra.push(pid);
    st.dirty = true;
    if (st.pendingSlot != null) { move(pid, { type: 'slot', index: st.pendingSlot }); st.pendingSlot = null; }
    renderView();
  },
  'add-extra'(el) {
    const pid = el.dataset.pid;
    if (!st.draft.data.extra.includes(pid)) st.draft.data.extra.push(pid);
    st.dirty = true; addPlayerDialog(); renderView();
    toast(`${displayName(st.pmap.get(pid))} hinzugefügt.`);
  },
  unextra(el) {
    const pid = el.dataset.pid;
    st.draft.data.extra = st.draft.data.extra.filter(x => x !== pid);
    if (st.sel === pid) st.sel = null;
    st.dirty = true; renderView();
  },
  'new-guest'() { setDlgKind('', ''); playerDialog({ ...PLAYER_DEFAULTS, is_guest: true }, { forDraft: true }); },

  // Präsenz
  'att-player'(el) { setDlgKind('att-player', el.dataset.id); attendanceDialog(el.dataset.id); },
  'att-reset': refreshDialogAfter(async el => {
    const s = sessionByDate(el.dataset.date);
    await api.setOverride(s.event.id, el.dataset.pid, null); await reload();
  }),
  'out-new'() { setDlgKind('', ''); outDialog(null); },
  'out-edit'(el) { setDlgKind('', ''); outDialog(el.dataset.id); },
  async 'fit-again'(el) {
    const p = st.pmap.get(el.dataset.id);
    await api.savePlayer({ id: p.id, out_until: todayIso() }); await reload(); closeDialog(); renderView();
    toast(`${displayName(p)} ist wieder fit. 💪`);
  },

  // Trainings
  'new-period'() { setDlgKind('', ''); periodDialog({}); },
  'edit-period'(el) { setDlgKind('', ''); periodDialog(st.data.training_periods.find(p => p.id === el.dataset.id)); },
  async 'del-period'(el) {
    if (!confirm('Diesen Zeitraum aus dem Trainingsplan löschen? Importierte Trainings bleiben erhalten.')) return;
    await api.deletePeriod(el.dataset.id); await reload(); renderView();
  },
  'toggle-old'() { st.showOld = !st.showOld; renderView(); },
  session(el) { setDlgKind('session', el.dataset.date); sessionDialog(el.dataset.date); },
  async cancel(el) {
    if (!confirm(`Training vom ${fmtDate(el.dataset.date)} absagen? Es zählt dann für niemanden.`)) return;
    await api.setCancelled(el.dataset.date, true); await reload(); closeDialog(); renderView(); toast('Training abgesagt.');
  },
  async uncancel(el) { await api.setCancelled(el.dataset.date, false); await reload(); renderView(); },

  // Spieler
  pfilter(el) { st.pFilter = el.dataset.f; renderView(); },
  'new-player'() { setDlgKind('', ''); playerDialog({ ...PLAYER_DEFAULTS }); },
  'edit-player'(el) {
    setDlgKind('', ''); playerDialog(st.pmap.get(el.dataset.id));
  },
  chip(el) { el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true')); },
  async 'del-player'(el) {
    const p = st.pmap.get(el.dataset.id);
    const note = p.sp_user_id ? '\n\nHinweis: Taucht die Person in einem späteren Import wieder auf, wird sie neu angelegt. Besser ist meist, «Im Kader» abzuwählen.' : '';
    if (!confirm(`${displayName(p)} löschen? Die Trainingspräsenz geht dabei verloren.${note}`)) return;
    await api.deletePlayer(p.id); closeDialog(); await reload(); renderView(); toast('Person gelöscht.');
  },

  // Import
  'do-import'() { return runImport(); },
  'cancel-import'() { st.preview = null; renderView(); },
  async 'del-event'(el) {
    const e = eventById(el.dataset.id);
    const n = st.data.lineups.filter(l => l.event_id === e.id).length;
    if (!confirm(`${e.kind === 'training' ? 'Training' : 'Spiel'} vom ${fmtDate(e.date)} löschen?${n ? ` Die ${n} Aufstellung(en) dazu werden ebenfalls gelöscht.` : ''}`)) return;
    await api.deleteEvent(e.id); await reload(); renderView(); toast('Termin gelöscht.');
  }
};

// Eingaben & Auswahlfelder
document.addEventListener('input', e => {
  const on = e.target.dataset?.on;
  if (on === 'title' && st.draft) {
    st.draft.title = e.target.value; st.dirty = true;
    const b = $('[data-act="save"]'); if (b) { b.disabled = false; b.textContent = 'Speichern'; }
  } else if (on === 'psearch') {
    st.pSearch = e.target.value; const pos = e.target.selectionStart; renderView();
    const i = $('[data-on="psearch"]'); i.focus(); i.setSelectionRange(pos, pos);
  } else if (on === 'addsearch') {
    st.addSearch = e.target.value; const pos = e.target.selectionStart; addPlayerDialog();
    const i = $('[data-on="addsearch"]', dlg()); i.focus(); i.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', e => {
  const t = e.target; const on = t.dataset?.on;
  if (on === 'game') { st.gameId = t.value; renderView(); }
  else if (on === 'formation') { st.draft.data.formation = t.value; st.dirty = true; st.pendingSlot = null; renderView(); }
  else if (on === 'files') { const fl = [...t.files]; t.value = ''; if (fl.length) guarded(() => handleFiles(fl)); }
  else if (on === 'pv-kind') { const ev = st.preview.events[+t.dataset.i]; ev.kind = t.value; ev.include = t.value !== 'ignore'; renderView(); }
  else if (on === 'pv-include') { st.preview.events[+t.dataset.i].include = t.checked; renderView(); }
  else if (on === 'opponent' || on === 'opponent-exp') {
    const id = on === 'opponent' ? st.gameId : st.draft.event_id;
    guarded(async () => {
      await api.updateEvent(id, { opponent: t.value.trim() }); await reload();
      if (on === 'opponent-exp') await exportDialog(); else toast('Gegner gespeichert.');
    });
  }
  else if (on === 'exp') {
    st.exportOpts[t.dataset.k] = t.checked; lsSet('exportOpts', st.exportOpts);
    guarded(exportDialog);
  }
  else if (on === 'att') {
    guarded(async () => {
      t.disabled = true;
      await setAttendance(t.dataset.date, t.dataset.pid, t.checked);
      const d = dlg().dataset;
      if (d.kind === 'att-player') attendanceDialog(d.ref); else if (d.kind === 'session') sessionDialog(d.ref);
      renderView();
    });
  }
  else if (on === 'outkind') {
    const ph = { lazarett: 'z.B. Knie, Muskelfaserriss', sonder: 'z.B. Fitnesscoach, Kassier' };
    t.form.out_title.placeholder = ph[t.value] || '';
  }
});

// Formulare in Dialogen
document.addEventListener('submit', e => {
  const f = e.target;
  const er = $('.error', f);
  const fail = msg => { er.hidden = false; er.textContent = msg; };
  if (f.dataset.form === 'player') {
    e.preventDefault();
    guarded(async () => {
      const fd = new FormData(f);
      const id = f.dataset.id;
      const forDraft = !!f.dataset.guestForDraft;
      const rec = {
        first_name: (fd.get('first_name') || '').trim(),
        last_name: (fd.get('last_name') || '').trim(),
        nickname: (fd.get('nickname') || '').trim(),
        positions: [...f.querySelectorAll('.chip[aria-pressed="true"]')].map(c => c.dataset.pos)
      };
      if (!rec.first_name && !rec.last_name && !rec.nickname) return fail('Bitte mindestens einen Namen eintragen.');
      if (forDraft) Object.assign(rec, { is_guest: true, active: true });
      else {
        Object.assign(rec, { role: fd.get('role') || 'spieler', active: fd.has('active'), is_guest: fd.has('is_guest') });
      }
      if (id) rec.id = id;
      const saved = await api.savePlayer(rec);
      await reload();
      closeDialog();
      if (forDraft && st.draft) { st.draft.data.extra.push(saved.id); st.dirty = true; toast(`${displayName(saved)} erfasst und hinzugefügt.`); }
      else toast('Gespeichert.');
      renderView();
    });
  } else if (f.dataset.form === 'out') {
    e.preventDefault();
    guarded(async () => {
      const fd = new FormData(f);
      const id = f.dataset.id || fd.get('pid');
      if (!id) return fail('Bitte eine Person wählen.');
      const from = nullDate(fd.get('out_from')) || todayIso();
      const until = nullDate(fd.get('out_until'));
      if (until && until <= from) return fail('Das Comeback muss nach dem «Seit»-Datum liegen.');
      await api.savePlayer({ id, out_kind: fd.get('out_kind') || 'lazarett', out_title: (fd.get('out_title') || '').trim(), out_from: from, out_until: until });
      await reload(); closeDialog(); renderView();
      toast(`${displayName(st.pmap.get(id))} ist ausser Gefecht.`);
    });
  } else if (f.dataset.form === 'period') {
    e.preventDefault();
    guarded(async () => {
      const fd = new FormData(f);
      const rec = { start_date: nullDate(fd.get('start_date')), end_date: nullDate(fd.get('end_date')), weekdays: [...f.querySelectorAll('.chip[aria-pressed="true"]')].map(c => +c.dataset.day) };
      if (!rec.start_date || !rec.end_date || rec.end_date < rec.start_date) return fail('Bitte gültige Daten wählen (Bis nach Von).');
      if (!rec.weekdays.length) return fail('Bitte mindestens einen Trainingstag wählen.');
      if (f.dataset.id) rec.id = f.dataset.id;
      await api.savePeriod(rec); await reload(); closeDialog(); renderView(); toast('Trainingsplan gespeichert.');
    });
  } else if (f.dataset.form === 'pw') {
    e.preventDefault();
    const fd = new FormData(f);
    if (fd.get('pw') !== fd.get('pw2')) return fail('Die beiden Passwörter stimmen nicht überein.');
    guarded(async () => { await api.changePassword(fd.get('pw')); closeDialog(); toast('Passwort geändert.'); });
  } else if (f.dataset.form === 'login') {
    e.preventDefault();
    const fd = new FormData(f); const b = $('button', f);
    b.disabled = true; er.hidden = true;
    api.signIn(fd.get('email').trim(), fd.get('password'))
      .then(start)
      .catch(err => { fail(err.message); b.disabled = false; });
  }
});
dlg().addEventListener('close', () => { dlg().dataset.kind = ''; if (st.data) renderView(); });

// Drag & Drop (Maus). Auf Touchgeräten: antippen und platzieren.
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('[draggable="true"][data-pid]');
  if (!el) return;
  st.drag = el.dataset.pid;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', st.drag); } catch { /* egal */ }
});
document.addEventListener('dragend', () => { st.drag = null; document.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover')); });
function dropTarget(e) {
  if (st.drag) return e.target.closest('.slot, [data-drop="bench"], [data-drop="pool"]');
  if (e.dataTransfer?.types?.includes('Files')) return e.target.closest('[data-drop="files"]');
  return null;
}
document.addEventListener('dragover', e => {
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault();
  document.querySelectorAll('.drop-hover').forEach(x => x !== t && x.classList.remove('drop-hover'));
  t.classList.add('drop-hover');
});
document.addEventListener('dragleave', e => { const t = dropTarget(e); if (t && !t.contains(e.relatedTarget)) t.classList.remove('drop-hover'); });
document.addEventListener('drop', e => {
  const t = dropTarget(e);
  if (!t) { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); return; }
  e.preventDefault();
  if (t.dataset.drop === 'files') { guarded(() => handleFiles([...e.dataTransfer.files])); return; }
  const pid = st.drag; st.drag = null;
  if (t.classList.contains('slot')) move(pid, { type: 'slot', index: +t.dataset.idx });
  else move(pid, { type: t.dataset.drop });
  st.sel = null; st.pendingSlot = null; renderView();
});
window.addEventListener('beforeunload', e => { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* =========================================================================
   Start
   ========================================================================= */
function loginHtml() {
  return `<div class="login"><form class="panel" data-form="login">
    <h1>${esc(TEAM)}</h1>
    <p class="muted" style="margin:0">Aufstellungen für das Trainerteam. Melde dich mit deinem Coach-Konto an.</p>
    <label class="field">E-Mail<input class="input" type="email" name="email" required autocomplete="username"></label>
    <label class="field">Passwort<input class="input" type="password" name="password" required autocomplete="current-password"></label>
    <p class="error" hidden></p>
    <button class="btn primary" type="submit">Anmelden</button>
  </form></div>`;
}

async function start() {
  try {
    st.user = await api.session();
    if (!st.user) { $('#app').innerHTML = loginHtml(); return; }
    if (!(await api.isCoach())) {
      $('#app').innerHTML = `<div class="login"><div class="panel"><h1>Kein Zugriff</h1>
        <p>Das Konto ${esc(st.user.email)} ist nicht als Coach freigeschaltet. Bitte den Admin, deine E-Mail in der Coach-Liste einzutragen.</p>
        <button class="btn" data-act="logout">Abmelden</button></div></div>`;
      return;
    }
    await reload();
    renderShell();
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="login"><div class="panel"><h1>Verbindung fehlgeschlagen</h1>
      <p>Die Daten konnten nicht geladen werden: ${esc(err.message)}</p>
      <p class="small muted">Prüfe die Werte in config.js und ob das Datenbank-Skript ausgeführt wurde.</p>
      <button class="btn primary" onclick="location.reload()">Neu laden</button></div></div>`;
  }
}
start();
