/* Backend stand-in for the public demo. Same shape as js/api.js, no network.
 *
 * The real CrewBASE talks to a private service and a private sheet: staff
 * PINs, real kitchens, real licensees, real handovers. None of that can go
 * on a public page, so this file answers every call from memory instead —
 * and the app above it does not know the difference, because the seam is
 * exactly the one the real client already had.
 *
 * Everything below is invented. The sites, the operators, the people and
 * the faults are made up to show how the app behaves; they are not this
 * company's data.
 */
"use strict";

const API_BASE = "";                       // nothing to reach
const IDLE_LOCK_MS = 5 * 60 * 1000;

const session = {
  get token()  { return sessionStorage.getItem("d.token") || ""; },
  get name()   { return sessionStorage.getItem("d.name") || ""; },
  get sites()  { try { return JSON.parse(sessionStorage.getItem("d.sites")) || []; } catch { return []; } },
  get home()   { try { return JSON.parse(sessionStorage.getItem("d.home")) || this.sites; } catch { return []; } },
  get idleMs() { return Date.now() - parseInt(sessionStorage.getItem("d.touched") || "0", 10); },
  touch()      { sessionStorage.setItem("d.touched", String(Date.now())); },
  save(a)      {
    sessionStorage.setItem("d.token", a.token);
    sessionStorage.setItem("d.name", a.name);
    this.setSites(a.sites, a.home_sites);
    this.touch();
  },
  setSites(sites, home) {
    sessionStorage.setItem("d.sites", JSON.stringify(sites || []));
    sessionStorage.setItem("d.home", JSON.stringify(home || sites || []));
  },
  clear() { ["d.token","d.name","d.sites","d.home","d.touched"].forEach((k) => sessionStorage.removeItem(k)); },
};

const RECENT_KEY = "d.recent", RECENT_MAX = 3;
const recent = {
  list() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY));
      return Array.isArray(raw) ? raw.filter((r) => r && r.id && r.label) : [];
    } catch { return []; }
  },
  remember(e) {
    localStorage.setItem(RECENT_KEY, JSON.stringify([
      { id: e.id, label: e.name, sites: e.sites || [], at: Date.now() },
      ...this.list().filter((r) => r.id !== e.id),
    ].slice(0, RECENT_MAX)));
  },
  forget(id) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(this.list().filter((r) => r.id !== id)));
  },
};

class ApiError extends Error {
  constructor(status, detail) { super(detail || `HTTP ${status}`); this.status = status; this.detail = detail; }
}

/* ---------- invented world ---------------------------------------------- */

const SITES = [
  { code: "S1", label: "S1 Riverbend", kitchens: 30 },
  { code: "S2", label: "S2 Kingsway",  kitchens: 24 },
  { code: "S3", label: "S3 Eastpoint", kitchens: 18 },
];

const STAFF = [
  { id: "d-aisha",  label: "Aisha Rahman", sites: ["S1", "S2", "S3"] },
  { id: "d-marcus", label: "Marcus Tan",   sites: ["S1"] },
  { id: "d-priya",  label: "Priya Nair",   sites: ["S2", "S3"] },
  { id: "d-weijun", label: "Wei Jun Ho",   sites: ["S1", "S2"] },
];

const day = 86400000;
const iso = (offset) => new Date(Date.now() - offset * day).toISOString().slice(0, 10);
const stamp = (offset, who) => {
  const d = new Date(Date.now() - offset * day);
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `[${d.getDate()} ${mon}, ${who}]`;
};

let nextRow = 100;
let ITEMS = [
  ["S1", "K7 Grill House", "Extraction hood running weak on the left burner",
   "In progress", "Critical", 2,
   [[2, "Marcus Tan", "reported"], [1, "Marcus Tan", "contractor booked for Thursday → Aisha Rahman"]]],
  ["S1", "K3 Noodle Bar", "Cold room door seal torn, holding 2°C above set point",
   "In progress", "High", 3,
   [[3, "Aisha Rahman", "reported"], [1, "Wei Jun Ho", "seal ordered, arriving Monday"]]],
  ["S1", "Loading bay", "Roller shutter stops halfway, needs a service call",
   "On hold", "Medium", 9,
   [[9, "Wei Jun Ho", "reported"], [4, "Wei Jun Ho", "waiting on landlord approval"]]],
  ["S1", "K12 Bao Bar", "Grease trap overdue for pump-out",
   "In progress", "", null,
   [[26, "Marcus Tan", "reported"]]],
  ["S2", "K2 Curry Pot", "Three-phase isolator tripping under full load",
   "In progress", "Critical", 1,
   [[4, "Priya Nair", "reported"], [1, "Priya Nair", "electrician on site tomorrow 9am → Wei Jun Ho"]]],
  ["S2", "Corridor B", "Ceiling tile stained, likely condensate from the AHU",
   "In progress", "Low", 30,
   [[15, "Wei Jun Ho", "reported"]]],
  ["S3", "K5 Poke Counter", "Handwash tap dripping, wastes water overnight",
   "In progress", "High", 5,
   [[2, "Priya Nair", "reported"]]],
  ["S3", "K9 Roti House", "Fryer thermostat reads 15° low against a probe",
   "Completed", "High", null,
   [[8, "Aisha Rahman", "reported"], [5, "Aisha Rahman", "thermostat swapped, tested against probe — reads true now"]],
   "Aisha Rahman", 5],
].map(([site, location, task, status, urgency, due_in, trail, done_by, done_off], i) => ({
  site, row: 10 + i, date: iso(trail[0][0]), age_days: trail[0][0],
  location, task, status,
  is_open: status !== "Completed",
  is_done: status === "Completed",
  last_update: trail.map(([off, who, text]) => `${stamp(off, who)} ${text}`).join("\n"),
  next_action: "", completed_by: done_by || "", completed_date: done_off ? iso(done_off) : "",
  urgency, due_in, media: [],
}));

const MOVES = [
  { site: "S1", kitchen: "K18", name: "Kopi & Co",        kind: "in",  date: iso(-6),  days: 6 },
  { site: "S2", kitchen: "K11", name: "Green Bowl",       kind: "out", date: iso(-2),  days: 2 },
  { site: "S1", kitchen: "K21", name: "Nasi Padang House", kind: "out", date: iso(1),  days: -1 },
  { site: "S3", kitchen: "K4",  name: "Dumpling Story",   kind: "in",  date: iso(-24), days: 24 },
];

const REVIEWS = { S1: { by: "Wei Jun Ho", when: iso(1) } };

/* A demo with no latency reads as a mock-up; the real thing waits on a
 * backend and a spreadsheet, and the skeletons and spinners exist because
 * of it. Keep just enough delay to show them working. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const Api = {
  async meta()   { await wait(120); return { sites: SITES.map((s) => ({ ...s, kitchens: Array.from({length: s.kitchens}, (_, i) => i + 1) })) }; },
  async roster() { await wait(120); return { staff: STAFF.map((s) => ({ ...s, has_pin: true })) }; },

  // Any four digits are accepted: this is a shop window, not a lock. The real
  // one hashes the PIN and throttles to five tries a minute.
  async login(id, pin) {
    await wait(220);
    const who = STAFF.find((s) => s.id === id);
    if (!who) throw new ApiError(404, "Unknown");
    if (!/^\d{4}$/.test(pin)) throw new ApiError(401, "Wrong PIN");
    return { id: who.id, token: "demo", name: who.label,
             sites: who.sites, home_sites: who.sites };
  },
  async claim(id, pin) { return this.login(id, pin); },
  async register(p) {
    await wait(240);
    const id = "d-" + p.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
    const sites = p.sites === "All" ? SITES.map((s) => s.code) : p.sites.split(/\s*,\s*/);
    STAFF.push({ id, label: p.name.split(/\s+/).slice(0, 2).join(" "), sites });
    return { id, token: "demo", name: p.name.split(/\s+/).slice(0, 2).join(" "),
             sites, home_sites: sites };
  },

  async items(site) {
    await wait(320);
    const rows = site && site !== "all" ? ITEMS.filter((i) => i.site === site) : ITEMS;
    return { items: JSON.parse(JSON.stringify(rows)), today: iso(0), reviews: REVIEWS };
  },
  async addItem(p) {
    await wait(300);
    ITEMS.unshift({
      site: p.site, row: nextRow++, date: iso(0), age_days: 0,
      location: p.location || "", task: p.task, status: "In progress",
      is_open: true, is_done: false,
      last_update: `${stamp(0, session.name)} reported`,
      next_action: "", completed_by: "", completed_date: "",
      urgency: p.urgency || "", due_in: p.urgency ? ({Critical:3,High:7,Medium:20,Low:45})[p.urgency] : null,
      media: [],
    });
    return { row: nextRow - 1 };
  },
  async update(p) {
    await wait(280);
    const it = ITEMS.find((i) => i.site === p.site && i.row === p.row);
    if (!it) throw new ApiError(404, "Gone");
    const bits = [p.note, p.handover_to ? `→ ${p.handover_to}` : ""].filter(Boolean).join(" ");
    if (bits) it.last_update += `\n${stamp(0, session.name)} ${bits}`;
    if (p.status) { it.status = p.status; it.is_open = p.status !== "Completed"; it.is_done = !it.is_open; }
    if (p.urgency) it.urgency = p.urgency;
    return { row: p.row };
  },
  async complete(p) {
    await wait(280);
    const it = ITEMS.find((i) => i.site === p.site && i.row === p.row);
    if (!it) throw new ApiError(404, "Gone");
    it.status = "Completed"; it.is_open = false; it.is_done = true;
    it.completed_by = session.name; it.completed_date = iso(0);
    it.last_update += `\n${stamp(0, session.name)} ${p.note}`;
    return { row: p.row };
  },
  async reviewDone(site) { await wait(200); REVIEWS[site] = { by: session.name, when: iso(0) }; return { ok: true }; },
  async moves() { await wait(220); return { moves: MOVES, renewals: [], today: iso(0) }; },
  async uploadMedia() { await wait(400); throw new ApiError(400, "Photos are switched off in the demo."); },
};
