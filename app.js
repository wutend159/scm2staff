'use strict';

/* =========================================================================
   Konfiguration & Konstanten
   ========================================================================= */
const CFG = window.APP_CONFIG || {};
// Umgebung wählen: «live» auf den eingetragenen Adressen, sonst «test» (z.B. Cloudflare-Vorschau oder lokal).
const ENV = (() => {
  const envs = CFG.environments;
  if (!envs) return CFG.supabaseUrl ? { name: 'live', supabaseUrl: CFG.supabaseUrl, supabaseAnonKey: CFG.supabaseAnonKey } : null;
  const host = location.hostname;
  if (envs.live && (envs.live.hosts || []).includes(host) && envs.live.supabaseUrl) return { name: 'live', ...envs.live };
  if (envs.test && envs.test.supabaseUrl) return { name: 'test', ...envs.test };
  return null;
})();
const DEMO = !(ENV && ENV.supabaseUrl && ENV.supabaseAnonKey);
const LOGIN_DOMAIN = CFG.loginDomain || 'scm2.invalid';
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
const myProfile = () => st.data?.profiles?.find(p => p.user_id === st.user?.id) || null;
function userName(id, email) {
  const pr = id && st.data?.profiles?.find(p => p.user_id === id);
  return pr ? (pr.display_name || pr.username) : emailName(email);
}
const isPlaceholderMail = e => !e || e.toLowerCase().endsWith('@' + LOGIN_DOMAIN.toLowerCase());
const nullDate = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/* =========================================================================
   Datenzugriff: Demo (Browser) oder Supabase
   ========================================================================= */
const PLAYER_DEFAULTS = {
  sp_user_id: null, sp_name: '', sp_roles: '', first_name: '', last_name: '', nickname: '', positions: [],
  role: 'spieler', out_kind: null, out_title: '', out_from: null, out_until: null, is_guest: false, active: true
};
const TABLES = ['players', 'events', 'participations', 'attendance_overrides', 'training_periods', 'training_cancellations', 'lineups', 'profiles', 'fixtures', 'league_table', 'results', 'sync_log'];

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
    async session() {
      if (!db.profiles.length) { db.profiles.push({ user_id: 'demo', username: 'demo', display_name: 'Demo Coach', player_id: null }); save(); }
      return { email: 'demo@lokal', id: 'demo' };
    },
    async updateProfile(fields) {
      if (fields.username && db.profiles.some(p => p.username === fields.username && p.user_id !== 'demo')) throw new Error('Dieser Benutzername ist schon vergeben.');
      return upsertBy('profiles', x => x.user_id === 'demo', fields);
    },
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
      const n = { team_name: '', name: '', time_start: '', time_meet: '', opponent: '', home_away: '', venue: '', ...ev, id: uid(), created_at: now() };
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
      const row = { event_id: l.event_id, title: l.title, data: l.data, updated_by_email: 'demo@lokal', updated_by: 'demo', updated_at: now() };
      if (l.id) return upsertBy('lineups', x => x.id === l.id, row);
      const n = { ...row, id: uid(), created_by_email: 'demo@lokal', created_by: 'demo', created_at: now() }; db.lineups.push(n); save(); return clone(n);
    },
    async deleteLineup(id) { db.lineups = db.lineups.filter(l => l.id !== id); save(); },
    async upsertFixtures(rows) { for (const r of rows) upsertBy('fixtures', x => x.match_no === r.match_no, r); }
  };
}

// Unsichtbare Zeichen (Zeilenumbrüche, Leerzeichen) aus kopierten Werten entfernen
const SB_URL = String(ENV?.supabaseUrl || '').trim().replace(/\/+$/, '');
const SB_KEY = String(ENV?.supabaseAnonKey || '').replace(/[\s\u200B-\u200D\uFEFF]+/g, '');
function keyProblem() {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL)) return 'Die supabaseUrl in config.js hat nicht die Form https://xxxx.supabase.co';
  if (SB_KEY.startsWith('sb_secret_')) return 'In config.js steht der geheime «secret»-Schlüssel. Bitte den «publishable» bzw. «anon public» Schlüssel verwenden.';
  if (/^eyJ/.test(SB_KEY)) {
    try {
      const role = JSON.parse(atob(SB_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
      if (role === 'service_role') return 'In config.js steht der «service_role»-Schlüssel. Bitte den «anon public» Schlüssel verwenden.';
    } catch { return 'Der Schlüssel in config.js ist unvollständig. Bitte nochmals vollständig kopieren.'; }
  } else if (!SB_KEY.startsWith('sb_publishable_')) return 'Der Schlüssel in config.js sieht nicht wie ein Supabase-Schlüssel aus.';
  return null;
}
const netMsg = err => (/load failed|failed to fetch|networkerror/i.test(err?.message || '')
  ? 'Keine Verbindung zu Supabase. Prüfe in config.js die URL und den Schlüssel (vollständig, ohne Leerzeichen).'
  : err?.message || String(err));

function makeSupabaseApi() {
  const sb = window.supabase.createClient(SB_URL, SB_KEY);
  const chk = ({ data, error }) => { if (error) throw new Error(netMsg(error)); return data; };
  let email = null, userId = null;
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
      userId = data.session?.user?.id || null;
      return data.session ? { email, id: userId } : null;
    },
    async signIn(ident, p) {
      ident = ident.trim();
      let mail = ident;
      if (!ident.includes('@')) { // Benutzername → E-Mail
        const { data, error } = await sb.rpc('login_email', { p_username: ident.toLowerCase() }).then(r => r, err => ({ error: err }));
        if (error) throw new Error(netMsg(error));
        if (!data) throw new Error('Benutzername oder Passwort ist falsch.');
        mail = data;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email: mail, password: p }).catch(err => ({ error: err }));
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'Benutzername oder Passwort ist falsch.' : netMsg(error));
      email = data.user.email; userId = data.user.id;
    },
    async updateProfile(fields) {
      const { data, error } = await sb.from('profiles').update(fields).eq('user_id', userId).select().single();
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Dieser Benutzername ist schon vergeben.' : /check/i.test(error.message) ? 'Der Benutzername darf nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten (2–30 Zeichen).' : netMsg(error));
      return data;
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
      const row = { event_id: l.event_id, title: l.title, data: l.data, updated_by_email: email, updated_by: userId, updated_at: new Date().toISOString() };
      if (l.id) return chk(await sb.from('lineups').update(row).eq('id', l.id).select().single());
      return chk(await sb.from('lineups').insert(row).select().single());
    },
    async deleteLineup(id) { chk(await sb.from('lineups').delete().eq('id', id)); },
    async upsertFixtures(rows) { if (rows.length) chk(await sb.from('fixtures').upsert(rows, { onConflict: 'match_no' })); }
  };
}

const SETUP_PROBLEM = DEMO ? null : keyProblem() || (window.supabase ? null : 'Die Supabase-Bibliothek konnte nicht geladen werden. Prüfe die Internetverbindung oder deaktiviere einen Inhaltsblocker für diese Seite.');
const api = DEMO ? makeLocalApi() : SETUP_PROBLEM ? null : makeSupabaseApi();

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
  mergeFixtures();
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
        ${ENV?.name === 'test' ? '<span class="env-badge" title="Testumgebung mit Testdatenbank">TEST</span>' : ''}
        <div class="who">
          <button class="btn ghost small" data-act="tab" data-tab="account" title="Konto">👤 ${esc(userName(st.user.id, st.user.email))}</button>
          ${DEMO ? '' : '<button class="btn ghost small" data-act="logout">Abmelden</button>'}
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
  const views = { lineup: () => (st.draft ? editorHtml() : lineupHomeHtml()), presence: presenceHtml, players: playersHtml, trainings: trainingsHtml, import: importHtml, account: accountHtml };
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

/* =========================================================================
   Spieltag: Spielinfos, Wetter, Warnungen, Hauptaufstellung
   ========================================================================= */
const HOME = CFG.homeLocation || { name: 'Chrüzegg, Menzingen', lat: 47.1777, lon: 8.5917 };
const lineupsOf = gameId => st.data.lineups.filter(l => l.event_id === gameId)
  .sort((a, b) => (b.data?.final === true) - (a.data?.final === true) || (a.created_at || '').localeCompare(b.created_at || ''));
const isFinal = l => l?.data?.final === true;
function gameTitle(game) {
  const opp = game.opponent || 'Gegner offen';
  return game.home_away === 'auswaerts' ? `${opp} – ${TEAM}` : `${TEAM} – ${opp}`;
}
function previousLineup(game) {
  const prev = games().filter(g => g.date < game.date).reverse();
  for (const g of prev) { const l = lineupsOf(g.id)[0]; if (l) return { game: g, lineup: l }; }
  return null;
}

// Warnungen für ein Spiel (und optional eine Aufstellung)
function gameWarnings(game, data) {
  const w = [];
  const ids = new Set(signedUp(game.id).map(p => p.id));
  for (const id of data?.extra || []) ids.add(id);
  const avail = [...ids].map(id => st.pmap.get(id)).filter(Boolean);
  const n = avail.length;
  if (n < 11) w.push({ lvl: 'bad', text: `Nur ${n} Spieler verfügbar, für 11 fehlen ${11 - n}.` });
  else if (n < 14) w.push({ lvl: 'warn', text: `Knappes Kader: ${n} Spieler, also ${n - 11} Wechsel.` });
  if (!avail.some(p => (p.positions || []).includes('TW'))) w.push({ lvl: 'bad', text: 'Kein Torhüter zugesagt.' });
  const noPos = avail.filter(p => !(p.positions || []).length);
  if (noPos.length) w.push({ lvl: 'info', text: `Ohne Position: ${noPos.map(displayName).join(', ')}.` });
  if (data) {
    const f = FORMATIONS[data.formation] || FORMATIONS[DEFAULT_FORMATION];
    const placed = (data.slots || []).filter(Boolean);
    if (placed.length < 11) w.push({ lvl: 'warn', text: `${11 - placed.length} Position${11 - placed.length === 1 ? '' : 'en'} noch frei.` });
    const gone = [...placed, ...(data.bench || [])].filter(id => !ids.has(id)).map(id => st.pmap.get(id)).filter(Boolean);
    if (gone.length) w.push({ lvl: 'bad', text: `Nicht mehr zugesagt: ${gone.map(displayName).join(', ')}.` });
    const wrong = (data.slots || []).map((id, i) => [st.pmap.get(id), f[i][0]]).filter(([p, pos]) => p && posTier(p, pos) === 2);
    if (wrong.length) w.push({ lvl: 'warn', text: `Nicht auf ihrer Position: ${wrong.map(([p, pos]) => `${shortName(p)} (${pos})`).join(', ')}.` });
    const bench = (data.bench || []).map(id => st.pmap.get(id)).filter(Boolean);
    if (bench.length && !bench.some(p => ['IV', 'LV', 'RV', 'DM'].some(pos => posTier(p, pos) === 0 || posTier(p, pos) === 1)))
      w.push({ lvl: 'info', text: 'Kein Abwehrspieler auf der Bank.' });
  }
  return w;
}
function warningsHtml(w) {
  if (!w.length) return '';
  const order = { bad: 0, warn: 1, info: 2 };
  w = [...w].sort((a, b) => order[a.lvl] - order[b.lvl]);
  const icon = { bad: '⛔', warn: '⚠️', info: 'ℹ️' };
  return `<ul class="warns">${w.map(x => `<li class="w-${x.lvl}"><span aria-hidden="true">${icon[x.lvl]}</span> ${esc(x.text)}</li>`).join('')}</ul>`;
}

// Wetter (Open-Meteo, ohne Schlüssel)
const WMO = { 0: ['☀️', 'sonnig'], 1: ['🌤️', 'meist sonnig'], 2: ['⛅', 'teils bewölkt'], 3: ['☁️', 'bedeckt'], 45: ['🌫️', 'Nebel'], 48: ['🌫️', 'Nebel'],
  51: ['🌦️', 'Niesel'], 53: ['🌦️', 'Niesel'], 55: ['🌦️', 'Niesel'], 56: ['🌧️', 'gefrierender Niesel'], 57: ['🌧️', 'gefrierender Niesel'],
  61: ['🌧️', 'leichter Regen'], 63: ['🌧️', 'Regen'], 65: ['🌧️', 'starker Regen'], 66: ['🌧️', 'Eisregen'], 67: ['🌧️', 'Eisregen'],
  71: ['🌨️', 'leichter Schnee'], 73: ['🌨️', 'Schnee'], 75: ['❄️', 'starker Schnee'], 77: ['🌨️', 'Schneegriesel'],
  80: ['🌦️', 'Regenschauer'], 81: ['🌧️', 'Regenschauer'], 82: ['⛈️', 'heftige Schauer'], 85: ['🌨️', 'Schneeschauer'], 86: ['🌨️', 'Schneeschauer'],
  95: ['⛈️', 'Gewitter'], 96: ['⛈️', 'Gewitter mit Hagel'], 99: ['⛈️', 'Gewitter mit Hagel'] };
st.weather = new Map();
async function geocode(text) {
  const key = 'geo:' + text.toLowerCase();
  const cached = lsGet(key, null); if (cached) return cached;
  const parts = [text, ...text.split(/[,/-]/).map(s => s.trim()).reverse(), ...text.split(/\s+/)].filter(s => s.length > 2);
  for (const q of [...new Set(parts)]) {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=de&countryCode=CH`);
      const j = await r.json();
      if (j.results?.length) { const g = { name: j.results[0].name, lat: j.results[0].latitude, lon: j.results[0].longitude }; lsSet(key, g); return g; }
    } catch { /* weiter versuchen */ }
  }
  return null;
}
async function loadWeather(game) {
  const k = `${game.id}|${game.date}|${game.time_start}|${game.home_away}|${game.venue}`;
  if (st.weather.has(k)) return st.weather.get(k);
  st.weather.set(k, { loading: true });
  let res;
  try {
    const days = (utc(game.date) - utc(todayIso())) / 864e5;
    if (days < 0) res = { none: true };
    else if (days > 15) res = { later: true, days: Math.ceil(days - 15) };
    else {
      const loc = game.home_away === 'auswaerts' ? (game.venue ? await geocode(game.venue) : null) : HOME;
      if (!loc) res = { noloc: true };
      else {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=Europe%2FZurich&start_date=${game.date}&end_date=${game.date}`;
        const j = await (await fetch(url)).json();
        const hour = parseInt((game.time_start || '15:00').slice(0, 2), 10);
        const i = Math.min(j.hourly.time.length - 1, Math.max(0, hour));
        res = { at: game.time_start ? 'zum Anpfiff' : 'um 15 Uhr', loc: loc.name, temp: Math.round(j.hourly.temperature_2m[i]), rain: j.hourly.precipitation_probability?.[i], code: j.hourly.weather_code[i], wind: Math.round(j.hourly.wind_speed_10m[i]) };
      }
    }
  } catch { res = { error: true }; }
  st.weather.set(k, res);
  return res;
}
function weatherHtml(w) {
  if (!w || w.loading) return '<span class="muted small">Wetter wird geladen …</span>';
  if (w.none) return '';
  if (w.later) return `<span class="muted small">Wetterprognose in ${w.days} Tag${w.days === 1 ? '' : 'en'} verfügbar.</span>`;
  if (w.noloc) return '<span class="muted small">Für das Wetter den Spielort eintragen.</span>';
  if (w.error) return '<span class="muted small">Wetter gerade nicht verfügbar.</span>';
  const [ic, txt] = WMO[w.code] || ['🌡️', ''];
  return `<span class="wx"><span class="wx-ic" aria-hidden="true">${ic}</span><strong>${w.temp}°</strong> ${esc(txt)}${w.rain != null ? `, Regen ${w.rain}%` : ''}, Wind ${w.wind} km/h <span class="muted small">(${esc(w.loc)}, ${w.at})</span></span>`;
}
function refreshWeather(game) {
  loadWeather(game).then(w => { const el = $('#wx'); if (el && st.gameId === game.id) el.innerHTML = weatherHtml(w); });
}

// Statische Feld-Vorschau
function pitchPreview(data) {
  const f = FORMATIONS[data.formation] || FORMATIONS[DEFAULT_FORMATION];
  return `<div class="pitch static" aria-label="Aufstellung ${esc(data.formation)}">${pitchLines()}${f.map(([pos, x, y], i) => {
    const p = st.pmap.get(data.slots?.[i]);
    return `<div class="slot${p ? ' filled' : ''}" style="left:${x}%;top:${y}%"><div class="disc">${esc(pos)}</div>${p ? `<div class="lbl">${esc(shortName(p))}</div>` : ''}</div>`;
  }).join('')}</div>`;
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
  const lus = lineupsOf(game.id);
  const main = lus[0];
  const variants = lus.slice(1);
  const t = todayIso();
  const prev = previousLineup(game);
  setTimeout(() => refreshWeather(game), 0);
  const venue = game.home_away === 'auswaerts' ? game.venue : (game.venue || HOME.name);
  return `
    <div class="toolbar">
      <select class="select game-select" data-on="game" aria-label="Spiel wählen">${g.map(e =>
        `<option value="${e.id}" ${e.id === game.id ? 'selected' : ''}>${esc(fmtDate(e.date))}${e.opponent ? ': ' + esc(e.opponent) : ''}${e.date < t ? ' (vorbei)' : ''}</option>`).join('')}</select>
    </div>
    <section class="matchday">
      <div class="md-main">
        <div class="md-date">${esc(fmtDate(game.date))}${game.time_start ? ` · ${esc(fmtTime(game.time_start))}` : ''}</div>
        <h2 class="md-title">${esc(gameTitle(game))}</h2>
        <div class="md-facts">
          ${game.time_meet ? `<span>Treffpunkt ${esc(fmtTime(game.time_meet))}</span>` : ''}
          ${venue ? `<span>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}" target="_blank" rel="noopener">${esc(venue)}</a></span>` : ''}
          <span>${ups.length} zugesagt</span>
          ${game._fx?.status && !/noch nicht ausgetragen/i.test(game._fx.status) ? `<span class="md-badge">${esc(game._fx.status)}</span>` : ''}
        </div>
        ${(() => { const r = ourResult(game); if (!r) return ''; const o = outcome(r, OUR_TEAM);
          return `<div class="md-result"><strong>${o.f}:${o.a}</strong> ${{ S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' }[o.res]}</div>`; })()}
        ${game._auto?.length ? `<div class="md-auto small">${esc(game._auto.join(', '))} aus dem Verbands-Spielplan</div>` : ''}
        <div id="wx" class="md-wx">${weatherHtml(st.weather.get(`${game.id}|${game.date}|${game.time_start}|${game.home_away}|${game.venue}`))}</div>
      </div>
      <button class="btn small md-edit" data-act="game-info">Spielinfos</button>
    </section>
    ${warningsHtml(gameWarnings(game, main?.data))}
    ${main ? `
      <section class="lu-main">
        <div class="lu-main-head">
          <div><h2>${esc(main.title || 'Aufstellung')}</h2>
            <div class="small muted">${esc(main.data?.formation || '')} · von ${esc(userName(main.created_by, main.created_by_email))}${main.updated_at ? `, geändert ${esc(fmtStamp(main.updated_at))}` : ''}</div></div>
          ${isFinal(main) ? '<span class="final-badge">✓ Definitiv</span>' : '<span class="draft-badge">Entwurf</span>'}
        </div>
        <div class="lu-main-body">
          ${pitchPreview(main.data || {})}
          <div class="lu-main-side">
            <h3>Ersatzbank</h3>
            <p>${(main.data?.bench || []).map(id => st.pmap.get(id)).filter(Boolean).map(p => esc(displayName(p))).join(', ') || '<span class="muted">leer</span>'}</p>
            <div class="row">
              <button class="btn primary" data-act="open-lineup" data-id="${main.id}">Bearbeiten</button>
              <button class="btn" data-act="dup-lineup" data-id="${main.id}">Variante erstellen</button>
            </div>
          </div>
        </div>
      </section>
      ${variants.length ? `<section class="section"><h3>Varianten</h3><div class="variant-list">${variants.map(l => `
        <div class="variant">
          ${miniPitch(l.data || {})}
          <div class="grow"><strong>${esc(l.title || 'Variante')}</strong>
            <div class="small muted">${esc(l.data?.formation || '')} · von ${esc(userName(l.created_by, l.created_by_email))}</div></div>
          <button class="btn small" data-act="open-lineup" data-id="${l.id}">Öffnen</button>
          <button class="btn small ghost danger" data-act="del-lineup" data-id="${l.id}">Löschen</button>
        </div>`).join('')}</div></section>` : ''}`
    : `
      <section class="panel lu-start">
        <h2>Aufstellung erstellen</h2>
        <div class="row">
          ${prev ? `<button class="btn primary" data-act="from-prev">Letzte übernehmen <span class="small">(${esc(fmtDate(prev.game.date, false, false))}${prev.game.opponent ? ' gegen ' + esc(prev.game.opponent) : ''})</span></button>` : ''}
          <button class="btn ${prev ? '' : 'primary'}" data-act="new-lineup">Leer beginnen</button>
        </div>
        ${prev ? '<p class="small muted">Übernimmt Formation, Startelf und Bank vom letzten Spiel. Wer nicht zugesagt hat, wird automatisch entfernt.</p>' : ''}
      </section>`}
    ${leagueHtml(game)}
    ${CFG.ifvWidgetUrl ? `<details class="section ifv" ${lsGet('ifvOpen', false) ? 'open' : ''} data-on="ifv-toggle">
      <summary><h2>Tabelle und Resultate</h2></summary>
      <iframe src="${esc(CFG.ifvWidgetUrl)}" title="Tabelle und Resultate (football.ch)" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      <p class="small muted">Daten: football.ch / IFV (offizielles Club-Widget).</p>
    </details>` : ''}`;
}

function gameInfoDialog() {
  const game = eventById(st.gameId);
  openDialog(`
    <form method="dialog" data-form="game">
      <div class="dlg-head"><h2>Spielinfos</h2><button type="button" class="x" data-act="close" aria-label="Schliessen">×</button></div>
      <div class="dlg-body">
        <label class="field">Gegner<input class="input" name="opponent" value="${esc(game.opponent || '')}" placeholder="z.B. FC Meggen III" autocomplete="off"></label>
        <div class="field">Heim oder auswärts
          <div class="kind-pick">
            <label class="kind-opt"><input type="radio" name="home_away" value="heim" ${game.home_away !== 'auswaerts' ? 'checked' : ''}><span>🏠 Heim</span></label>
            <label class="kind-opt"><input type="radio" name="home_away" value="auswaerts" ${game.home_away === 'auswaerts' ? 'checked' : ''}><span>🚌 Auswärts</span></label>
          </div></div>
        <label class="field">Spielort <span class="small muted" style="font-weight:400">bei Heimspielen leer lassen = ${esc(HOME.name)}</span>
          <input class="input" name="venue" value="${esc(game.venue || '')}" placeholder="z.B. Ebnet, Küssnacht" autocomplete="off"></label>
        <div class="grid2">
          <label class="field">Anpfiff<input class="input" type="time" name="time_start" value="${esc(fmtTime(game.time_start))}"></label>
          <label class="field">Treffpunkt<input class="input" type="time" name="time_meet" value="${esc(fmtTime(game.time_meet))}"></label>
        </div>
        <p class="error" hidden></p>
      </div>
      <div class="dlg-foot"><button type="button" class="btn" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div>
    </form>`);
}

/* ---------- Liga-Daten (Spielplan, Tabelle, Resultate) ---------- */
const OUR_TEAM = CFG.leagueTeamName || 'SC Menzingen II';
const LEAGUE_GROUP = CFG.leagueGroup || 'Gruppe 3';
const normTeam = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const isUs = n => normTeam(n) === normTeam(OUR_TEAM);
const cleanVenue = v => String(v || '').replace(/\s+-\s+.*$/, '').trim();
// Ergänzt Spiele aus SpielerPlus mit Gegner, Ort und Zeit aus dem Verbands-Spielplan (nur leere Felder).
function mergeFixtures() {
  for (const e of st.data.events) {
    if (e.kind !== 'spiel') continue;
    const fx = (st.data.fixtures || []).find(f => f.date === e.date && (isUs(f.home) || isUs(f.away)));
    e._fx = fx || null; e._auto = [];
    if (!fx) continue;
    const home = isUs(fx.home);
    if (!e.opponent) { e.opponent = home ? fx.away : fx.home; e._auto.push('Gegner'); }
    if (!e.home_away) { e.home_away = home ? 'heim' : 'auswaerts'; e._auto.push('Heim/Auswärts'); }
    if (!e.venue && fx.venue) { e.venue = cleanVenue(fx.venue); e._auto.push('Ort'); }
    if (!e.time_start && fx.time) { e.time_start = fx.time; e._auto.push('Anpfiff'); }
  }
}
const teamResults = team => (st.data.results || []).filter(r => normTeam(r.home) === normTeam(team) || normTeam(r.away) === normTeam(team))
  .sort((a, b) => b.date.localeCompare(a.date));
function outcome(r, team) {
  const h = normTeam(r.home) === normTeam(team);
  const f = h ? r.home_goals : r.away_goals, a = h ? r.away_goals : r.home_goals;
  return { f, a, res: f > a ? 'S' : f < a ? 'N' : 'U', opp: h ? r.away : r.home, home: h };
}
const ourResult = game => (st.data.results || []).find(r => r.date === game.date && (isUs(r.home) || isUs(r.away)));
const FORM_DE = { W: 'S', D: 'U', L: 'N' };
const formChips = letters => `<span class="form">${[...letters].map(c => `<span class="fc fc-${FORM_DE[c] || c}" title="${{ S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' }[FORM_DE[c] || c] || ''}">${FORM_DE[c] || c}</span>`).join('')}</span>`;
const resLine = (r, team) => {
  const o = outcome(r, team);
  return `<li><span class="fc fc-${o.res}">${o.res}</span> <span class="muted small">${esc(fmtDate(r.date, false))}</span> ${o.home ? '' : '@ '}${esc(o.opp)} <strong>${o.f}:${o.a}</strong></li>`;
};
function leagueHtml(game) {
  const lt = (st.data.league_table || []).find(x => x.group_name === LEAGUE_GROUP);
  const rows = lt?.rows || [];
  const opp = game.opponent;
  const oppRow = rows.find(r => normTeam(r.team) === normTeam(opp));
  const oppRes = opp ? teamResults(opp).filter(r => !(r.date === game.date && (isUs(r.home) || isUs(r.away)))).slice(0, 5) : [];
  const h2h = opp ? teamResults(OUR_TEAM).filter(r => normTeam(r.home) === normTeam(opp) || normTeam(r.away) === normTeam(opp)) : [];
  const next = (st.data.fixtures || []).filter(f => f.date >= todayIso() && (isUs(f.home) || isUs(f.away))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const log = [...(st.data.sync_log || [])].sort((a, b) => (b.ran_at || '').localeCompare(a.ran_at || ''))[0];
  if (!rows.length && !oppRes.length && !h2h.length && !next.length) return '';
  return `
    <section class="section league">
      <div class="league-grid">
        ${rows.length ? `<div class="panel">
          <h3>Tabelle ${esc(LEAGUE_GROUP)}</h3>
          <div class="table-wrap"><table class="lt">
            <thead><tr><th>#</th><th>Team</th><th class="num">Sp</th><th class="num">Diff</th><th class="num">Pkt</th><th>Form</th></tr></thead>
            <tbody>${rows.map(r => `<tr class="${isUs(r.team) ? 'us' : normTeam(r.team) === normTeam(opp) ? 'opp' : ''}">
              <td>${r.rank}</td><td>${esc(r.team)}</td><td class="num">${r.sp}</td><td class="num">${r.diff > 0 ? '+' : ''}${r.diff}</td><td class="num"><strong>${r.pkt}</strong></td><td>${formChips(r.form || '')}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>` : ''}
        <div class="panel opp-panel">
          ${opp ? `<h3>Gegner: ${esc(opp)}</h3>
          ${oppRow ? `<p class="opp-rank"><strong>${oppRow.rank}.</strong> mit ${oppRow.pkt} Punkten, Tore ${oppRow.t}:${oppRow.gt} ${oppRow.form ? formChips(oppRow.form) : ''}</p>` : ''}
          <h4>Letzte Resultate</h4>
          ${oppRes.length ? `<ul class="res">${oppRes.map(r => resLine(r, opp)).join('')}</ul>` : '<p class="small muted">Noch keine gespeichert. Sie sammeln sich mit jedem Abruf.</p>'}
          <h4>Direktvergleich</h4>
          ${h2h.length ? `<ul class="res">${h2h.map(r => resLine(r, OUR_TEAM)).join('')}</ul>` : '<p class="small muted">Noch keine Duelle gespeichert.</p>'}`
          : '<p class="muted">Gegner noch nicht bekannt.</p>'}
          ${next.length ? `<h4>Nächste Spiele laut Verband</h4><ul class="res">${next.map(f => `<li><span class="muted small">${esc(fmtDate(f.date, true, false))}${f.time ? ' ' + esc(fmtTime(f.time)) : ''}</span> ${isUs(f.home) ? 'gegen' : '@'} ${esc(isUs(f.home) ? f.away : f.home)}${f.status && !/noch nicht ausgetragen/i.test(f.status) ? ` <span class="badge warn">${esc(f.status)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
      ${log ? `<p class="small ${log.ok ? 'muted' : 'error'}">${log.ok ? 'Liga-Daten' : 'Letzter Abruf mit Problemen'}: Stand ${esc(fmtStamp(log.ran_at))}${log.ok ? '' : ` (${esc(log.message)})`}. Quellen: IFV-Spielplan, footstats.ch.</p>` : ''}
    </section>`;
}

/* ---------- Spielplan-Import von Hand (ICS oder CSV vom IFV) ---------- */
function parseIcsClient(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let ev = null;
  const un = v => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    ev[line.slice(0, i).split(';')[0].toUpperCase()] = un(line.slice(i + 1));
  }
  return out.map(e => {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(e.DTSTART || '');
    if (!m) return null;
    const [home, away] = (e.SUMMARY || '').split(/\s+-\s+/).map(t => t.replace(/\s*\(\d+\.?\)\s*$/, '').trim());
    const desc = (e.DESCRIPTION || '').split('\n').map(x => x.trim()).filter(Boolean);
    const nr = (desc.join(' ').match(/Spielnummer\s+(\d+)/) || [])[1] || (e.UID || '').split('@')[0];
    const idx = desc.findIndex(x => /^Spielnummer/.test(x));
    const status = idx >= 0 && desc[idx + 1] && !/^https?:/.test(desc[idx + 1]) ? desc[idx + 1] : '';
    return { match_no: String(nr), date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` === '00:00' ? '' : `${m[4]}:${m[5]}:00`,
      home: home || '', away: away || '', venue: (e.LOCATION || '').trim(), status, competition: desc.slice(0, 2).join(' ').replace(/\s+/g, ' ') };
  }).filter(Boolean);
}
function parseIfvCsv(rows) {
  return rows.filter(r => r.Spielnummer && r.Spieldatum).map(r => ({
    match_no: r.Spielnummer, date: spDate(r.Spieldatum), time: r.Spielzeit ? r.Spielzeit.slice(0, 5) + ':00' : '',
    home: r['Teamname A'] || '', away: r['Teamname B'] || '', venue: r.Spielort || '', status: '', competition: `${r.SpielTyp || ''} ${r.Bezeichnung || ''}`.replace(/\s+/g, ' ').trim()
  })).filter(r => r.date);
}
async function readText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

function draftFromPrevious(game) {
  const prev = previousLineup(game);
  const d = newDraft(game, prev.lineup);
  const avail = new Set(signedUp(game.id).map(p => p.id));
  const removed = [];
  d.data.slots = (d.data.slots || []).map(id => { if (id && !avail.has(id)) { removed.push(id); return null; } return id; });
  d.data.bench = (d.data.bench || []).filter(id => { if (!avail.has(id)) { removed.push(id); return false; } return true; });
  d.data.extra = [];
  d.data.final = false;
  d.title = `Aufstellung ${userName(st.user.id, st.user.email)}`;
  return { d, removed: removed.map(id => st.pmap.get(id)).filter(Boolean) };
}

function newDraft(game, base) {
  return {
    id: null, event_id: game.id,
    title: base ? `${base.title} – Variante` : `Aufstellung ${userName(st.user.id, st.user.email)}`,
    data: base ? { ...clone(base.data), final: false } : { formation: DEFAULT_FORMATION, slots: Array(11).fill(null), bench: [], extra: [], final: false }
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
      <button class="btn ${d.final ? 'final-on' : ''}" data-act="toggle-final" title="Markiert diese Aufstellung als die gültige für das Spiel">${d.final ? '✓ Definitiv' : 'Als definitiv markieren'}</button>
      <button class="btn primary" data-act="save" ${st.dirty ? '' : 'disabled'}>${st.dirty ? 'Speichern' : 'Gespeichert'}</button>
    </div>
    <div class="small muted" style="margin:-.4rem 0 .8rem">${esc(fmtDate(game.date))}${game.opponent ? ' gegen ' + esc(game.opponent) : ''}. ${filled}/11 auf dem Feld, ${bench.length} auf der Bank.</div>
    ${warningsHtml(gameWarnings(game, d))}
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

function accountHtml() {
  const pr = myProfile();
  const linked = pr?.player_id ? st.pmap.get(pr.player_id) : null;
  const people = st.data.players.filter(p => p.active && !p.is_guest).sort(byName);
  if (!pr) {
    return `<div class="panel empty"><h2>Kein Profil</h2><p>Für dieses Konto ist noch kein Benutzername eingerichtet. Der Admin kann das in Supabase mit <code>add_coach</code> nachholen (siehe README). Anmelden geht bis dahin mit der E-Mail-Adresse.</p></div>`;
  }
  return `
    <h2 style="margin-bottom:1rem">Konto</h2>
    <div class="account-grid">
      <form class="panel form-stack" data-form="profile">
        <h3>Profil</h3>
        <label class="field">Name<input class="input" name="display_name" value="${esc(pr.display_name)}" autocomplete="name" placeholder="z.B. Cédric Mouchous"></label>
        <label class="field">Benutzername<input class="input" name="username" value="${esc(pr.username)}" autocomplete="username" autocapitalize="none" spellcheck="false" required pattern="[a-z0-9._\-]{2,30}">
          <span class="small muted" style="font-weight:400">Zum Anmelden. Kleinbuchstaben, Zahlen, Punkt, Bindestrich, Unterstrich.</span></label>
        <div class="field">E-Mail
          <div class="readonly">${isPlaceholderMail(st.user.email) ? '<span class="muted">keine hinterlegt</span>' : esc(st.user.email)}</div>
          <span class="small muted" style="font-weight:400">Wird vom Admin in Supabase geändert.</span></div>
        <label class="field">Ich in der Spielerliste
          <select class="select" name="player_id"><option value="">Nicht verknüpft</option>${people.map(p => `<option value="${p.id}" ${pr.player_id === p.id ? 'selected' : ''}>${esc(displayName(p))}${p.sp_name && p.sp_name !== displayName(p) ? ` (${esc(p.sp_name)})` : ''}</option>`).join('')}</select>
          <span class="small muted" style="font-weight:400">${linked ? `Verknüpft mit ${esc(displayName(linked))}.` : 'Verknüpft dein Konto mit deinem Eintrag als Spieler oder Trainer.'}</span></label>
        <p class="error" hidden></p>
        <div><button class="btn primary" type="submit">Profil speichern</button></div>
      </form>
      <form class="panel form-stack" data-form="pw">
        <h3>Passwort ändern</h3>
        <input type="text" name="username" value="${esc(pr.username)}" autocomplete="username" hidden>
        <label class="field">Neues Passwort<input class="input" type="password" name="pw" minlength="8" required autocomplete="new-password"></label>
        <label class="field">Wiederholen<input class="input" type="password" name="pw2" minlength="8" required autocomplete="new-password"></label>
        <p class="error" hidden></p>
        <div><button class="btn primary" type="submit">Passwort ändern</button></div>
      </form>
    </div>
    ${DEMO ? '' : '<div class="section"><button class="btn" data-act="logout">Abmelden</button></div>'}`;
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
  const fixtures = [];
  for (const file of files) {
    let rows, text;
    try { text = await readText(file); } catch { problems.push(`${file.name}: konnte nicht gelesen werden.`); continue; }
    if (/^\uFEFF?BEGIN:VCALENDAR/.test(text)) { fixtures.push(...parseIcsClient(text)); continue; }
    try { rows = parseCsv(text); } catch { problems.push(`${file.name}: konnte nicht gelesen werden.`); continue; }
    if (rows.length && 'Spielnummer' in rows[0] && 'Teamname A' in rows[0]) { fixtures.push(...parseIfvCsv(rows)); continue; }
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
  if (fixtures.length) {
    await api.upsertFixtures(fixtures.map(f => ({ ...f, updated_at: new Date().toISOString() })));
    await reload();
    toast(`${fixtures.length} Spiele aus dem Verbands-Spielplan übernommen.`);
    if (!evMap.size && !problems.length) { st.preview = null; renderView(); return; }
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
      <strong>Dateien hier ablegen oder auswählen</strong>
      <span class="small muted">SpielerPlus: Termin-Export (wöchentlich) oder Statistik-Export (gelegentlich, mit Absagen). Verband: Spielplan als Kalender (.ics) oder CSV, falls der automatische Abruf mal nicht klappt. Mehrere Dateien gehen auch. Ein bereits importierter Termin wird mit dem neuen Stand ersetzt; von Hand gesetzte Häkchen bleiben erhalten.</span>
      <input type="file" accept=".csv,text/csv,.ics,text/calendar" multiple data-on="files" style="position:absolute;opacity:0;width:1px;height:1px">
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
  'toggle-final'() { st.draft.data.final = !st.draft.data.final; st.dirty = true; renderView(); },
  'game-info'() { setDlgKind('', ''); gameInfoDialog(); },
  'from-prev'() {
    const { d, removed } = draftFromPrevious(eventById(st.gameId));
    openDraft(d);
    toast(removed.length ? `Übernommen. Nicht zugesagt und entfernt: ${removed.map(shortName).join(', ')}.` : 'Letzte Aufstellung übernommen.');
  },
  async save(el) {
    el.disabled = true; el.textContent = 'Speichere …';
    const saved = await api.saveLineup(st.draft);
    st.draft.id = saved.id; st.dirty = false;
    if (st.draft.data.final) { // nur eine definitive Aufstellung pro Spiel
      for (const l of st.data.lineups.filter(x => x.event_id === st.draft.event_id && x.id !== saved.id && x.data?.final)) {
        await api.saveLineup({ ...l, data: { ...l.data, final: false } });
      }
    }
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
  } else if (f.dataset.form === 'game') {
    e.preventDefault();
    guarded(async () => {
      const fd = new FormData(f);
      const tm = v => (v ? String(v).slice(0, 5) + ':00' : '');
      await api.updateEvent(st.gameId, {
        opponent: String(fd.get('opponent') || '').trim(), home_away: fd.get('home_away') || 'heim',
        venue: String(fd.get('venue') || '').trim(), time_start: tm(fd.get('time_start')), time_meet: tm(fd.get('time_meet'))
      });
      await reload(); closeDialog(); renderView(); toast('Spielinfos gespeichert.');
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
    guarded(async () => { await api.changePassword(fd.get('pw')); closeDialog(); f.reset?.(); toast('Passwort geändert.'); });
  } else if (f.dataset.form === 'profile') {
    e.preventDefault();
    const fd = new FormData(f);
    const username = String(fd.get('username') || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,30}$/.test(username)) return fail('Der Benutzername darf nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten (2–30 Zeichen).');
    api.updateProfile({ username, display_name: String(fd.get('display_name') || '').trim(), player_id: fd.get('player_id') || null })
      .then(async () => { await reload(); renderShell(); toast('Profil gespeichert.'); })
      .catch(err => fail(err.message));
  } else if (f.dataset.form === 'login') {
    e.preventDefault();
    const fd = new FormData(f); const b = $('button', f);
    b.disabled = true; er.hidden = true;
    api.signIn(String(fd.get('email')), fd.get('password'))
      .then(start)
      .catch(err => { fail(err.message); b.disabled = false; });
  }
});
document.addEventListener('toggle', e => { if (e.target.matches?.('details.ifv')) lsSet('ifvOpen', e.target.open); }, true);
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
    <label class="field">Benutzername<input class="input" type="text" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
    <label class="field">Passwort<input class="input" type="password" name="password" required autocomplete="current-password"></label>
    <p class="error" hidden></p>
    <button class="btn primary" type="submit">Anmelden</button>
  </form></div>`;
}

async function start() {
  const kp = SETUP_PROBLEM;
  if (kp) {
    $('#app').innerHTML = `<div class="login"><div class="panel"><h1>Einstellung prüfen</h1><p>${esc(kp)}</p>
      <p class="small muted">Zu finden in Supabase unter Project Settings → API Keys.</p></div></div>`;
    return;
  }
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
