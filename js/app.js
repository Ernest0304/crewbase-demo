/* 值班交接 App — screens and flows. English-only UI (10 Aug 2026).
 *
 * Structure: one <section> per screen, shown/hidden by show(); modal
 * work (item detail, update, complete, handover) happens in a bottom
 * sheet built with DOM calls — no innerHTML anywhere, every string a
 * user or the sheet supplies is inserted as text, never as markup.
 */
"use strict";

const $ = (id) => document.getElementById(id);

const App = {
  meta: null,          // {sites:[{code,label,kitchens}]}
  roster: [],          // login picker + handover name chips
  all: null,           // every site's items, as fetched; null until the first
  items: [],           // the slice of App.all the current site filter shows
  site: "",            // current Today filter ('' = my first site)
  seg: "open",         // open | hold | done
  q: "",               // search query on Today
  pickedId: "",        // login: staff id being logged in
  leave: { queue: [], i: 0, site: "" },
};

/* ---------- tiny UI helpers --------------------------------------------- */

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function fmt(key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/* Icons are drawn, never pasted as markup — the only strings that reach the
 * DOM here are path data written in this file. */
function icon(d) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function busy(btn, on) {
  btn.disabled = on;
}

/* Urgency ladder (mirrors the backend): resolve-by window in days. */
const URGENCY = [
  ["Critical", 3], ["High", 7], ["Medium", 20], ["Low", 45],
];

function urgencyChips(container, selected, onPick) {
  container.replaceChildren(...URGENCY.map(([name, days]) => {
    const c = el("button", "chip u-" + name.toLowerCase() +
                 (selected === name ? " on" : ""), `${name} · ≤${days}d`);
    c.type = "button";
    c.addEventListener("click", () => onPick(name, c));
    return c;
  }));
}

/* Media helpers: attachments stream through the backend with signed
 * URLs (the drive is members-only; phones have no Google accounts). */
function mediaThumb(m) { return API_BASE + m.thumb; }
function mediaView(m)  { return API_BASE + m.url; }

/* Does a free-text successor ("Marcus", "Aisha Rahman (Runner)") mean me? */
function isMe(target) {
  const norm = (x) => x.replace(/\s*\(.*\)$/, "").trim().toLowerCase()
    .split(/\s+/).slice(0, 2).join(" ");
  const t = norm(target || "");
  return t.length > 0 && t === norm(session.name || "");
}

function handedTarget(it) {
  const last = (it.last_update || "").split("\n").filter(Boolean).pop() || "";
  const m = last.match(/\u2192\s*([^\u2192]+)$/);
  return m ? m[1].trim() : "";
}

/* '[9 Aug, Name]' -> Date (assumes the current year; a stamp that lands
 * in the future belongs to last year). */
function trailLineDate(line) {
  const m = (line || "").match(/^\[(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mi = months.indexOf(m[2]);
  if (mi < 0) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), mi, parseInt(m[1], 10));
  if (d - now > 86400000) d = new Date(now.getFullYear() - 1, mi, parseInt(m[1], 10));
  return d;
}

function lastTrailInfo(it) {
  const lines = (it.last_update || "").split("\n").filter(Boolean);
  if (!lines.length) return null;
  const line = lines[lines.length - 1];
  const sig = line.match(/^\[([^,\]]+),\s*([^\]]+)\]/);
  return { date: trailLineDate(line), by: sig ? sig[2] : "" };
}

/* First/last signed trail lines -> who reported / last touched it. */
function trailWho(it) {
  const lines = (it.last_update || "").split("\n").filter(Boolean);
  const sig = (l) => {
    const m = l.match(/^\[([^,\]]+),\s*([^\]]+)\]/);
    return m ? { date: m[1], by: m[2] } : null;
  };
  return {
    reported: lines.length ? sig(lines[0]) : null,
    last: lines.length > 1 ? sig(lines[lines.length - 1]) : null,
  };
}

function handleError(e) {
  if (e && e.status === 401) {
    session.clear();
    closeSheet();
    enterLogin();                       // reloads meta + roster for the picker
    toast(t("err.session"));
    return;
  }
  toast(e && e.detail ? e.detail : t("err.generic"));
}

/* meta + roster together. Both are unauthenticated and cheap; every
 * screen needs meta and the login picker + handover chips need roster,
 * so one loader keeps "loaded" a single question with a single answer. */
async function ensureCore() {
  if (App.meta && App.roster.length) return;
  const [meta, ros] = await Promise.all([Api.meta(), Api.roster()]);
  App.meta = meta;
  App.roster = ros.staff;
}

/* ---------- screens ------------------------------------------------------ */

const SCREENS = ["login", "today", "log", "moves", "leave"];

function show(name) {
  SCREENS.forEach((s) => { $(`scr-${s}`).hidden = s !== name; });
  $("nav").hidden = name === "login";
  document.querySelectorAll("#nav button").forEach((b) => {
    b.classList.toggle("on", b.dataset.nav === name);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll("#nav button").forEach((b) => {
  b.addEventListener("click", async () => {
    const name = b.dataset.nav;
    show(name);
    try { await ensureCore(); }
    catch (e) { handleError(e); return; }
    if (name === "today") loadToday();
    if (name === "log") renderLogForm();
    if (name === "moves") renderMoves();
    if (name === "leave") renderLeaveIntro();
  });
});

/* ---------- bottom sheet ------------------------------------------------- */

function openSheet(build) {
  const sheet = $("sheet");
  sheet.replaceChildren(el("div", "grab"));
  build(sheet);
  const close = el("button", "btn ghost", t("sheet.close"));
  close.addEventListener("click", closeSheet);
  sheet.append(close);
  sheet.hidden = false;
  $("sheet-backdrop").hidden = false;
  sheet.tabIndex = -1;
  sheet.focus();
  // Android back / browser back closes the sheet instead of leaving.
  if (!history.state || !history.state.sheet) {
    history.pushState({ sheet: true }, "");
  }
}

function closeSheet() {
  if ($("sheet").hidden) return;
  $("sheet").hidden = true;
  $("sheet-backdrop").hidden = true;
  if (history.state && history.state.sheet) history.back();
}

$("sheet-backdrop").addEventListener("click", closeSheet);
window.addEventListener("popstate", () => {
  if (!$("sheet").hidden) {
    $("sheet").hidden = true;
    $("sheet-backdrop").hidden = true;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});

/* ---------- boot --------------------------------------------------------- */

async function boot() {
  fillCopy(document);
  // A reload can inherit {sheet:true} from a previous page; openSheet
  // would then skip pushState and the first back-swipe exits the PWA.
  if (history.state && history.state.sheet) history.replaceState(null, "");
  if (session.token && session.idleMs < IDLE_LOCK_MS) {
    session.touch();
    show("today");
    try {
      // Both go out now: the item list no longer needs to know which site is
      // showing, so it stops waiting behind meta and roster. One less crossing
      // of the sea before anything appears.
      const items = Api.items("all");
      await ensureCore();
      await loadToday(items);
    } catch (e) { renderTodayError(e); }
  } else {
    session.clear();
    await enterLogin();
  }
}

/* ---------- login: pick name -> PIN / claim / register ------------------- */

async function enterLogin() {
  show("login");
  loginStep("pick");
  try {
    await ensureCore();
    renderRecent();
    renderNameList("");
  } catch (e) { handleError(e); }
}

/* "5m ago" — coarse on purpose. The question is "was that me this morning or
 * last week", not what o'clock it was. */
function whenAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 2) return t("when.now");
  if (mins < 60) return fmt("when.mins", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return fmt("when.hours", { n: hours });
  return fmt("when.days", { n: Math.floor(hours / 24) });
}

/* Everyone who has signed in on this device and is STILL on the roster.
 * Someone your manager sets Active=FALSE stops appearing here on their own — a
 * shortcut that errors when tapped would be worse than no shortcut. */
function renderRecent() {
  const box = $("login-recent");
  const known = new Map(App.roster.map((s) => [s.id, s]));
  const rows = recent.list().filter((r) => known.has(r.id));
  // Drop anyone off the roster for good rather than only hiding them: the
  // list holds three, and a departed colleague would otherwise keep a slot
  // for ever and push a working colleague off a shared tablet.
  recent.list().filter((r) => !known.has(r.id)).forEach((r) => recent.forget(r.id));
  box.hidden = rows.length === 0;
  if (box.hidden) return;
  box.querySelector(".field-label").textContent =
    t(rows.length > 1 ? "login.recent.many" : "login.recent.one");

  $("login-recent-list").replaceChildren(...rows.map((r, i) => {
    const s = known.get(r.id);
    const li = el("li", i === 0 ? "lead" : "");

    // The site they will actually land on, not the four they are cleared for.
    // Today opens on the first of a person's sites, so that is the one worth
    // the line; listing all four says nothing and pushes the timestamp off a
    // narrow screen.
    const home = App.meta.sites.find((m) => m.code === s.sites[0]);
    const who = el("span", "recent-who");
    who.append(el("span", "recent-name", s.label),
               el("span", "recent-meta",
                  [home && home.label, fmt("login.recent.used", { when: whenAgo(r.at) })]
                    .filter(Boolean).join("  ·  ")));
    const b = el("button", "recent");
    b.append(el("span", "avatar", initials(s.label)), who);
    b.addEventListener("click", () => pickStaff(s));

    const x = el("button", "recent-x");
    x.setAttribute("aria-label", fmt("login.recent.forget", { name: s.label }));
    x.append(icon("M6 6l12 12M18 6L6 18"));
    x.addEventListener("click", () => { recent.forget(r.id); renderRecent(); });

    li.append(b, x);
    return li;
  }));
}

function loginStep(step) {
  ["pick", "pin", "claim", "reg"].forEach((s) => {
    $(`login-${s}`).hidden = s !== step;
  });
}

/* The one way into the PIN step, whether the name came from the list or from
 * the shortcut — two copies of this drift apart the first time either changes. */
function pickStaff(s) {
  App.pickedId = s.id;
  if (s.has_pin) {
    $("login-pin-name").textContent = s.label;
    $("login-pin-input").value = "";
    loginStep("pin");
    $("login-pin-input").focus();
  } else {
    $("login-claim-name").textContent = s.label;
    $("claim-pin1").value = ""; $("claim-pin2").value = "";
    loginStep("claim");
    $("claim-pin1").focus();
  }
}

function renderNameList(filter) {
  const list = $("login-names");
  const q = filter.trim().toLowerCase();
  const hits = App.roster.filter((s) => s.label.toLowerCase().includes(q));
  list.replaceChildren(...hits.map((s) => {
    const li = el("li");
    const b = el("button");
    b.append(el("span", "avatar", initials(s.label)),
             el("span", "", s.label),
             el("span", "tag", s.sites.join(" ")));
    b.addEventListener("click", () => pickStaff(s));
    li.append(b);
    return li;
  }));
  const empty = $("login-empty");
  empty.dataset.copy = App.roster.length === 0 ? "login.empty" : "login.nomatch";
  fillCopy(empty.parentElement);
  empty.hidden = hits.length > 0;
}

$("login-search").addEventListener("input", (e) => {
  // Once someone is typing a name they are looking for a specific person;
  // the shortcut would just push the results they asked for off the screen.
  $("login-recent").hidden = e.target.value.trim() !== "" || recent.list().length === 0;
  renderNameList(e.target.value);
});
$("login-to-register").addEventListener("click", async () => {
  // A fast finger can beat the boot fetch — the site chips need meta.
  try { await ensureCore(); }
  catch (e) { handleError(e); return; }
  renderRegisterForm();
  loginStep("reg");
});
document.querySelectorAll("#scr-login [data-back]").forEach((b) => {
  b.addEventListener("click", () => loginStep("pick"));
});

async function afterAuth(auth) {
  session.save(auth);
  // One choke point for login, first-PIN and register alike, so no path can
  // sign someone in without leaving them the shortcut next time.
  if (auth.id) recent.remember(auth);
  App.site = "";
  App.seg = "open";
  App.q = "";
  show("today");
  await loadToday();
}

$("login-pin-go").addEventListener("click", async (ev) => {
  const pin = $("login-pin-input").value.trim();
  busy(ev.target, true);
  try {
    await afterAuth(await Api.login(App.pickedId, pin));
  } catch (e) {
    if (e.detail === "NO_PIN") {
      // your manager cleared this person's PIN — send them to set a new one.
      $("login-claim-name").textContent = $("login-pin-name").textContent;
      $("claim-pin1").value = ""; $("claim-pin2").value = "";
      loginStep("claim");
    } else if (e && e.status === 401) {
      // A 401 HERE means the four digits were wrong — not that a session
      // expired. Routing it through handleError would clear a session that
      // does not exist, throw the person back to the name list and tell them
      // "your session has expired", which is neither true nor useful. Stay
      // put, empty the field, keep the cursor: the retry is four taps.
      $("login-pin-input").value = "";
      $("login-pin-input").focus();
      toast(t("login.pin.wrong"));
    } else handleError(e);
  } finally { busy(ev.target, false); }
});

/* A four-digit PIN has exactly one length, so the fourth digit IS the submit.
 * The app locks every five idle minutes now, which makes this the most-repeated
 * action of a shift — the button stays for anyone who prefers it, and for
 * screen readers, but nobody has to reach for it. */
function submitOnFourth(input, button) {
  input.addEventListener("input", () => {
    // Guard against a paste of more than four and against firing twice while
    // the first request is still in the air.
    if (input.value.trim().length === 4 && !button.disabled) button.click();
  });
}
submitOnFourth($("login-pin-input"), $("login-pin-go"));
// First-time PIN: the first field hands over to the second, the second submits.
$("claim-pin1").addEventListener("input", (e) => {
  if (e.target.value.trim().length === 4) $("claim-pin2").focus();
});
submitOnFourth($("claim-pin2"), $("claim-go"));

$("claim-go").addEventListener("click", async (ev) => {
  const p1 = $("claim-pin1").value.trim(), p2 = $("claim-pin2").value.trim();
  if (p1 !== p2) { toast(t("claim.mismatch")); return; }
  busy(ev.target, true);
  try {
    await afterAuth(await Api.claim(App.pickedId, p1));
  } catch (e) { handleError(e); }
  finally { busy(ev.target, false); }
});

/* ---------- register ------------------------------------------------------ */

function renderRegisterForm() {
  const wrap = $("reg-sites");
  wrap.replaceChildren(...App.meta.sites.map((s) => {
    const c = el("button", "chip", s.label);
    c.type = "button";
    c.dataset.code = s.code;
    c.addEventListener("click", () => c.classList.toggle("on"));
    return c;
  }));
  ["reg-name", "reg-role", "reg-pin1", "reg-pin2"].forEach((id) => { $(id).value = ""; });
}

$("reg-go").addEventListener("click", async (ev) => {
  const name = $("reg-name").value;
  const sites = [...$("reg-sites").querySelectorAll(".chip.on")]
    .map((c) => c.dataset.code).join(", ");
  const p1 = $("reg-pin1").value.trim(), p2 = $("reg-pin2").value.trim();
  if (p1 !== p2) { toast(t("claim.mismatch")); return; }
  busy(ev.target, true);
  try {
    await afterAuth(await Api.register({
      name, pin: p1, sites, role: $("reg-role").value,
    }));
  } catch (e) {
    if (e.detail && e.detail.startsWith("ALREADY_REGISTERED:")) {
      const existingId = e.detail.split(":")[1];
      openSheet((sheet) => {
        sheet.append(
          el("h2", "", t("reg.exists.title")),
          el("p", "muted", name.trim()),
        );
        const login = el("button", "btn primary", t("reg.exists.login"));
        login.addEventListener("click", async () => {
          closeSheet();
          await enterLogin();
          const hit = App.roster.find((s) => s.id === existingId);
          if (hit) {
            App.pickedId = hit.id;
            $("login-pin-name").textContent = hit.label;
            $("login-claim-name").textContent = hit.label;
            loginStep(hit.has_pin ? "pin" : "claim");
          }
        });
        const dup = el("button", "btn ghost", t("reg.exists.dup"));
        dup.addEventListener("click", async () => {
          busy(dup, true);
          try {
            await afterAuth(await Api.register({
              name, pin: p1, sites, role: $("reg-role").value,
              allow_duplicate: true,
            }));
            closeSheet();
          } catch (e2) { handleError(e2); }
          finally { busy(dup, false); }
        });
        sheet.append(login, dup);
      });
    } else handleError(e);
  } finally { busy(ev.target, false); }
});

/* ---------- today --------------------------------------------------------- */

function mySites() {
  const mine = session.sites.filter((s) => App.meta.sites.some((m) => m.code === s));
  return mine.length ? mine : App.meta.sites.map((s) => s.code);
}

function currentSite() {
  return App.site || mySites()[0];
}

function renderSiteChips(container, selected, onPick, withAll, everySite) {
  // Planning views (Moves) show every site; day-to-day views stay
  // scoped to the person's own sites.
  const codes = everySite ? App.meta.sites.map((s) => s.code) : [...mySites()];
  const chips = codes.map((code) => {
    const c = el("button", "chip" + (code === selected ? " on" : ""), code);
    c.addEventListener("click", () => onPick(code));
    return c;
  });
  if (withAll) {
    const all = el("button", "chip" + (selected === "all" ? " on" : ""), t("today.all"));
    all.addEventListener("click", () => onPick("all"));
    chips.push(all);
  }
  container.replaceChildren(...chips);
}

function greetKey() {
  // The phone's own clock: a greeting is about the reader's morning,
  // not Singapore's (item ageing stays SGT server-side).
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 18) return "greet.evening";
  return hour < 12 ? "greet.morning" : "greet.afternoon";
}

function renderGreeting() {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  $("greet-date").textContent =
    `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  // Two deliberate lines — a small salutation, then the name at display
  // scale on its own unbreakable line (the guide: control wrapping,
  // never let a mobile headline break mid-name).
  $("greet-line").replaceChildren(
    el("span", "hello", `${t(greetKey())},`),
    el("span", "gname", session.name),
  );
  $("who-avatar").textContent = initials(session.name);
}

function renderStats(open) {
  const stale = open.filter((i) => (i.age_days ?? 0) > 7).length;
  const undated = open.filter((i) => i.age_days === null).length;
  const tile = (n, key, cls) => {
    const d = el("div", `stat ${cls}${n ? "" : " zero"}`);
    d.append(el("span", "num", String(n)), el("span", "lbl", t(key)));
    return d;
  };
  $("today-stats").replaceChildren(
    tile(open.length, "stats.open", "s-open"),
    tile(stale, "stats.stale", "s-stale"),
    tile(undated, "stats.undated", "s-undated"),
  );
}

function renderSegments() {
  const segs = [["open", "seg.open"], ["hold", "seg.hold"], ["done", "seg.done"]];
  $("today-segs").replaceChildren(...segs.map(([key, copy]) => {
    const c = el("button", "chip" + (App.seg === key ? " on" : ""), t(copy));
    c.addEventListener("click", () => {
      App.seg = key;
      renderList();
      renderSegments();
    });
    return c;
  }));
}

function accentClass(it) {
  if (it.is_done) return "acc-fresh";
  if (it.status.toLowerCase() === "on hold") return "acc-hold";
  if (it.age_days === null) return "acc-undated";
  if (it.due_in !== null && it.due_in !== undefined) {
    if (it.due_in <= 0) return "acc-stale";
    return "acc-u-" + it.urgency.toLowerCase();
  }
  return it.age_days > 7 ? "acc-stale" : it.age_days >= 3 ? "acc-warn" : "acc-fresh";
}

function ageBadge(it) {
  if (it.is_done) return el("span", "badge fresh", "Done");
  if (it.status.toLowerCase() === "on hold") {
    return el("span", "badge hold", t("upd.st.hold"));
  }
  if (it.age_days === null) {
    return el("span", "badge undated", t("today.undated"));
  }
  // With an urgency set, the badge counts down to the deadline instead
  // of counting up from the raise date.
  if (it.due_in !== null && it.due_in !== undefined) {
    if (it.due_in < 0) return el("span", "badge stale", fmt("urg.overdue", { n: -it.due_in }));
    if (it.due_in === 0) return el("span", "badge stale", t("urg.due.today"));
    const cls = "u-" + it.urgency.toLowerCase();
    return el("span", `badge ${cls}`, fmt("urg.left", { n: it.due_in }));
  }
  const d = it.age_days;
  const cls = d > 7 ? "stale" : d >= 3 ? "warn" : "fresh";
  return el("span", `badge ${cls}`, `${d}d`);
}

/* Reference-style card: small meta line on top (where), the task as the
 * bold title, the latest trail line below. */
function itemCard(it, clickable) {
  const b = el(clickable ? "button" : "div", `card ${accentClass(it)}`);
  const row1 = el("div", "row1");
  if (it._new) row1.append(el("span", "newdot", ""));
  const meta = [it.location || "—", it.site].filter(Boolean).join(" · ");
  if (it.urgency && !it.is_done) {
    row1.append(el("span", "u-tag u-" + it.urgency.toLowerCase(), it.urgency));
  }
  row1.append(el("span", "loc-meta", meta), ageBadge(it));
  b.append(row1);
  b.append(el("div", "title", it.task));
  // Last update, rendered as "Name · date — note" when the line is
  // signed (app-written lines always are; hand-typed history shows
  // verbatim because nobody signed it).
  const lastLine = (it.last_update || "").split("\n").filter(Boolean).pop();
  if (lastLine) {
    const row = el("div", "last");
    const sig = lastLine.match(/^\[([^,\]]+),\s*([^\]]+)\]\s*(.*)$/);
    if (sig) {
      row.append(el("span", "by", `${sig[2]} · ${sig[1]}`));
      if (sig[3]) row.append(document.createTextNode(" — " + sig[3]));
    } else {
      row.textContent = lastLine;
    }
    b.append(row);
  }
  if (it.is_done) {
    const who = [it.completed_by, it.completed_date].filter(Boolean).join(" · ");
    if (who) b.append(el("div", "mine", `${t("item.completed")}: ${who}`));
  } else if (it.touched) {
    b.append(el("div", "mine", t("today.touched")));
  }
  if (clickable) b.addEventListener("click", () => openItemSheet(it));
  return b;
}

function segItems() {
  const q = App.q.trim().toLowerCase();
  let rows;
  if (App.seg === "done") {
    rows = App.items.filter((i) => i.is_done);
    rows.sort((a, b) => b.row - a.row);           // latest completions first
    rows = rows.slice(0, 30);
  } else if (App.seg === "hold") {
    rows = App.items.filter((i) => i.is_open && i.status.toLowerCase() === "on hold");
  } else {
    rows = App.items.filter((i) => i.is_open && i.status.toLowerCase() !== "on hold");
    // Undated first (they need a date), then by soonest deadline, then
    // legacy no-urgency rows oldest-first.
    const grp = (i) => i.age_days === null ? 0 : i.due_in != null ? 1 : 2;
    rows.sort((a, b) => {
      if (grp(a) !== grp(b)) return grp(a) - grp(b);
      if (grp(a) === 1) return a.due_in - b.due_in;
      return (b.age_days ?? 0) - (a.age_days ?? 0);
    });
  }
  if (q) {
    rows = rows.filter((i) =>
      `${i.location} ${i.task} ${i.last_update}`.toLowerCase().includes(q));
  }
  return rows;
}

function renderList() {
  const rows = segItems();
  const nodes = [];
  const addCard = (it) => {
    const li = el("li");
    li.append(itemCard(it, true));
    nodes.push(li);
  };
  const head = (text) => {
    const li = el("li");
    li.append(el("p", "listhead", text));
    nodes.push(li);
  };
  if (App.seg === "open") {
    // Items whose latest trail line names ME as the successor come
    // first — the whole product exists so these don't sit unseen.
    const mine = rows.filter((it) => isMe(handedTarget(it)));
    const rest = rows.filter((it) => !isMe(handedTarget(it)));
    if (mine.length) {
      head(`${t("sec.handed")} (${mine.length})`);
      mine.forEach(addCard);
      if (rest.length) head(t("sec.open"));
    }
    rest.forEach(addCard);
  } else {
    rows.forEach(addCard);
  }
  $("today-list").replaceChildren(...nodes);
  const empty = $("today-empty");
  empty.hidden = rows.length > 0;
  empty.querySelector("p").textContent =
    App.q.trim() ? t("today.nomatch") : t("today.empty");
}

let _todaySeq = 0;

/* One fetch covers every site, so switching sites is a filter rather than a
 * round trip. The backend is on the other side of the sea and a whole site's
 * open work is a few dozen rows — asking again per tap cost seconds to move
 * data the phone already had. */
async function loadToday(pending) {
  const seq = ++_todaySeq;   // a later refresh wins over a slower response
  const first = !App.all;
  renderGreeting();
  renderSegments();
  if (first) {
    $("today-empty").hidden = true;
    // Skeleton cards while the sheet answers — the layout holds still.
    $("today-list").replaceChildren(...[0, 1, 2].map(() => {
      const li = el("li");
      li.append(el("div", "skel"));
      return li;
    }));
  }
  try {
    const data = await (pending || Api.items("all"));
    if (seq !== _todaySeq) return;
    App.all = data.items;
    App.reviews = data.reviews || {};

    // "What changed while I was away?" — marked once per fetch, over every
    // site, so a mark does not depend on which site happened to be open.
    const seenKey = `hv.seen.${session.name}`;
    const prevSeen = parseInt(localStorage.getItem(seenKey) || "0", 10);
    for (const it of data.items) {
      const info = lastTrailInfo(it);
      it._new = !!(prevSeen && info && info.date
        && info.date.getTime() > prevSeen && !isMe(info.by));
    }
    localStorage.setItem(seenKey, String(Date.now()));
    paintToday();
  } catch (e) {
    if (seq !== _todaySeq) return;
    if (!App.all) renderTodayError(e);   // keep what is on screen if we have it
  }
}

/* Everything that depends on WHICH site is showing. No network: a site tap
 * repaints from what the last fetch brought back. */
function paintToday() {
  const site = currentSite();
  renderSiteChips($("today-sites"), site, (code) => {
    App.site = code;
    paintToday();          // instant
    loadToday();           // and quietly catch up, in case the sheet moved on
  }, true);
  App.items = site === "all" ? App.all : App.all.filter((i) => i.site === site);
  const open = App.items.filter((i) => i.is_open);
  const changed = App.items.filter((i) => i._new && i.is_open).length;

  let sub = site === "all"
    ? fmt("today.sub.all", { n: open.length })
    : fmt("today.sub", { n: open.length, site });
  if (changed) sub += ` \u00b7 ${fmt("new.count", { n: changed })}`;
  $("greet-sub").textContent = sub;

  const rv = $("today-review");
  if (site !== "all") {
    const r = App.reviews[site];
    rv.textContent = r
      ? fmt("review.line", { by: r.by, when: r.when })
      : t("review.none");
    rv.hidden = false;
  } else {
    rv.hidden = true;
  }

  renderStats(open);
  renderList();
}

/* A blank screen behind a 2.6s toast is a dead end — leave a retry. */
function renderTodayError(e) {
  const li = el("li");
  const box = el("div", "card");
  box.append(el("p", "muted", e && e.detail ? e.detail : t("err.generic")));
  const retry = el("button", "btn", t("common.retry"));
  retry.addEventListener("click", async () => {
    try { await ensureCore(); } catch (e2) { handleError(e2); return; }
    loadToday();
  });
  box.append(retry);
  li.append(box);
  $("today-list").replaceChildren(li);
  if (e && e.status === 401) handleError(e);
}

$("today-search").addEventListener("input", (e) => {
  App.q = e.target.value;
  renderList();
});

$("btn-logout").addEventListener("click", () => {
  session.clear();
  enterLogin();
});

/* ---------- item detail sheet --------------------------------------------- */

function openItemSheet(it, onDone) {
  openSheet((sheet) => {
    const row1 = el("div", "row1");
    const meta = [it.location || "—", it.site].filter(Boolean).join(" · ");
    row1.append(el("span", "loc-meta", meta), ageBadge(it));
    sheet.append(row1, el("h2", "", it.task));

    if (it.urgency) {
      const days = (URGENCY.find(([n]) => n === it.urgency) || [0, 0])[1];
      let tail = "";
      if (it.due_in !== null && it.due_in !== undefined) {
        tail = it.due_in < 0 ? " · " + fmt("urg.overdue", { n: -it.due_in })
             : it.due_in === 0 ? " · " + t("urg.due.today")
             : " · " + fmt("urg.left", { n: it.due_in });
      }
      sheet.append(el("p", "u-line u-" + it.urgency.toLowerCase(),
        `${it.urgency} — ${fmt("urg.within", { n: days })}${tail}`));
    }
    const who = trailWho(it);
    if (who.reported || it.completed_by) {
      const bits = [];
      if (who.reported) bits.push(`${t("item.reported")}: ${who.reported.by} · ${who.reported.date}`);
      if (who.last) bits.push(`${t("item.lastby")}: ${who.last.by} · ${who.last.date}`);
      sheet.append(el("p", "muted small", bits.join("   ")));
    }

    const trail = el("div", "trail");
    const lines = (it.last_update || "").split("\n").filter(Boolean);
    if (lines.length) lines.forEach((l) => trail.append(el("p", "", l)));
    else trail.append(el("p", "muted", t("item.trail.none")));
    sheet.append(el("label", "", t("item.trail")), trail);

    if (it.next_action) {
      sheet.append(el("label", "", t("item.next")), el("p", "", it.next_action));
    }

    renderMediaSection(sheet, it, onDone);

    if (it.is_done) {
      const who = [it.completed_by, it.completed_date].filter(Boolean).join(" · ");
      if (who) sheet.append(el("p", "muted small", `${t("item.completed")}: ${who}`));
      return;   // the full trail above IS the story; nothing left to do
    }

    const actions = el("div", "actions");
    const bU = el("button", "btn", t("item.act.update"));
    bU.addEventListener("click", () => openUpdateSheet(it, onDone));
    const bH = el("button", "btn", t("item.act.handover"));
    bH.addEventListener("click", () => openHandoverSheet(it, onDone));
    const bC = el("button", "btn primary", t("item.act.complete"));
    bC.addEventListener("click", () => openCompleteSheet(it, onDone));
    actions.append(bU, bH, bC);
    sheet.append(actions);
  });
}

function refreshAfterWrite() {
  closeSheet();
  loadToday();
}

function conflictRetry(e, onDone) {
  if (e && e.status === 409) {
    closeSheet();
    toast(t("upd.conflict"));
    // In the leave walkthrough, move on; this item can't be pinned down
    // from here. On Today, refresh so the list matches the sheet again.
    if (onDone) onDone(); else loadToday();
    return true;
  }
  return false;
}

function openUpdateSheet(it, onDone) {
  openSheet((sheet) => {
    sheet.append(el("h2", "", `${t("upd.title")} · ${it.location || it.site}`));

    sheet.append(el("label", "", t("upd.note")));
    const note = el("textarea");
    note.rows = 3;
    note.placeholder = t("upd.note.ph");
    sheet.append(note);

    sheet.append(el("label", "", t("upd.next")));
    const next = el("input");
    next.value = it.next_action || "";
    sheet.append(next);

    sheet.append(el("label", "", t("urg.label")));
    let urgency = null;
    const uwrap = el("div", "chips");
    urgencyChips(uwrap, it.urgency || "", (name, chip) => {
      urgency = name;
      uwrap.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === chip));
    });
    sheet.append(uwrap);

    sheet.append(el("label", "", t("upd.status")));
    const chips = el("div", "chips");
    let status = null;
    const mk = (label, value) => {
      const c = el("button", "chip" + (it.status === value ? " on" : ""), label);
      c.type = "button";
      c.addEventListener("click", () => {
        status = value;
        chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
      });
      return c;
    };
    chips.append(
      mk(t("upd.st.progress"), "In progress"),
      mk(t("upd.st.hold"), "On hold"),
    );
    sheet.append(chips);

    const save = el("button", "btn primary", t("upd.save"));
    save.addEventListener("click", async () => {
      const body = {
        site: it.site, row: it.row, expect_task: it.task,
        note: note.value,
      };
      if (next.value.trim() !== (it.next_action || "")) body.next_action = next.value;
      if (status) body.status = status;
      if (urgency && urgency !== it.urgency) body.urgency = urgency;
      if (!body.note.trim() && body.next_action === undefined && !body.status
          && body.urgency === undefined) {
        closeSheet(); return;   // nothing changed — not an error
      }
      busy(save, true);
      try {
        await Api.update(body);
        toast(t("upd.saved"));
        onDone ? (closeSheet(), onDone()) : refreshAfterWrite();
      } catch (e) {
        if (!conflictRetry(e, onDone)) handleError(e);
      } finally { busy(save, false); }
    });
    sheet.append(save);
  });
}

function openCompleteSheet(it, onDone) {
  openSheet((sheet) => {
    sheet.append(el("h2", "", `${t("cpl.title")} · ${it.location || it.site}`));
    sheet.append(el("p", "muted", it.task));

    sheet.append(el("label", "", t("cpl.note")));
    const note = el("textarea");
    note.rows = 2;
    note.placeholder = t("cpl.note.ph");
    sheet.append(note);

    const go = el("button", "btn primary", t("cpl.confirm"));
    go.addEventListener("click", async () => {
      // "Done" without the how is a hole in the record — the next person
      // (and the vendor follow-up) needs the resolution, not just a tick.
      if (!note.value.trim()) { toast(t("cpl.required")); note.focus(); return; }
      busy(go, true);
      try {
        await Api.complete({
          site: it.site, row: it.row, expect_task: it.task, note: note.value,
        });
        toast(t("cpl.done"));
        onDone ? (closeSheet(), onDone()) : refreshAfterWrite();
      } catch (e) {
        if (!conflictRetry(e, onDone)) handleError(e);
      } finally { busy(go, false); }
    });
    sheet.append(go);
  });
}

function openHandoverSheet(it, onDone) {
  openSheet((sheet) => {
    sheet.append(el("h2", "", t("ho.title")));
    sheet.append(el("p", "muted small", t("ho.hint")));

    const chips = el("div", "chips");
    const free = el("input");
    free.placeholder = t("ho.free.ph");
    // session.name is the compact display form (first two words); roster
    // labels are full names, sometimes with a "(Role)" suffix — compare
    // like with like or the person hands items to themselves.
    const disp = (label) =>
      label.replace(/\s*\(.*\)$/, "").split(/\s+/).slice(0, 2).join(" ");
    App.roster
      .filter((s) => disp(s.label) !== session.name)
      .slice(0, 12)
      .forEach((s) => {
        const c = el("button", "chip", s.label);
        c.type = "button";
        c.addEventListener("click", () => {
          free.value = s.label;
          chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
        });
        chips.append(c);
      });
    sheet.append(chips, free);

    sheet.append(el("label", "", t("ho.note")));
    const note = el("input");
    sheet.append(note);

    const go = el("button", "btn primary", t("ho.go"));
    go.addEventListener("click", async () => {
      if (!free.value.trim()) { free.focus(); return; }
      busy(go, true);
      try {
        await Api.update({
          site: it.site, row: it.row, expect_task: it.task,
          note: note.value, handover_to: free.value,
        });
        toast(t("ho.done"));
        onDone ? (closeSheet(), onDone()) : refreshAfterWrite();
      } catch (e) {
        if (!conflictRetry(e, onDone)) handleError(e);
      } finally { busy(go, false); }
    });
    sheet.append(go);
  });
}

/* ---------- media (photos & videos on an item) ---------------------------- */

function mediaTile(m) {
  const a = el("a", "mtile" + (m.kind === "video" ? " vid" : ""));
  a.href = mediaView(m);
  a.target = "_blank";
  a.rel = "noopener";
  const img = el("img");
  img.loading = "lazy";
  img.alt = "";
  img.src = mediaThumb(m);
  img.addEventListener("error", () => img.remove());   // no thumb yet: plain tile
  a.append(img);
  if (m.kind === "video") {
    const badge = el("span", "playmark");
    badge.textContent = "\u25B6";
    a.append(badge);
  }
  return a;
}

function renderMediaSection(sheet, it, onDone) {
  const media = it.media || [];
  if (!media.length && it.is_done) return;
  sheet.append(el("label", "", `${t("media.label")} (${media.length}/15)`));
  const grid = el("div", "mediagrid");
  media.forEach((m) => grid.append(mediaTile(m)));

  if (!it.is_done && media.length < 15) {
    const add = el("button", "mtile addtile", "+");
    add.type = "button";
    const input = el("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.hidden = true;
    add.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const files = [...input.files];
      if (!files.length) return;
      if (media.length + files.length > 15) { toast(t("media.limit")); return; }
      if (files.some((f) => f.size > 80 * 1024 * 1024)) { toast(t("media.toobig")); return; }
      add.disabled = true;
      add.textContent = "\u2026";
      try {
        const out = await Api.uploadMedia(it.site, it.row, it.task, files);
        it.media = out.media;
        openItemSheet(it, onDone);        // rebuild the sheet with fresh tiles
      } catch (e) { handleError(e); add.disabled = false; add.textContent = "+"; }
    });
    grid.append(add, input);
  }
  sheet.append(grid);
}

/* ---------- log an item --------------------------------------------------- */

function renderLogForm() {
  let site = currentSite() === "all" ? mySites()[0] : currentSite();
  let urgency = "Medium";                      // sensible default, one tap to change
  const kitchens = () => App.meta.sites.find((s) => s.code === site).kitchens;

  // The kitchen keypad lives in a bottom sheet (a 30-cell grid parked
  // on the form was too much furniture — your manager, 10 Aug). The field
  // itself stays free-text for corridors, bin stores, anything else.
  $("log-pick-kitchen").onclick = () => {
    openSheet((sheet) => {
      sheet.append(el("h2", "", `${t("log.loc")} · ${site}`));
      const grid = el("div", "kgrid sheetgrid");
      const current = $("log-loc").value.trim();
      grid.append(...kitchens().map((n) => {
        const c = el("button", "kcell" + (current === `K${n}` ? " on" : ""), `K${n}`);
        c.type = "button";
        c.addEventListener("click", () => {
          $("log-loc").value = `K${n}`;
          closeSheet();
        });
        return c;
      }));
      sheet.append(grid);
    });
  };

  urgencyChips($("log-urgency"), urgency, (name, chip) => {
    urgency = name;
    chip.parentElement.querySelectorAll(".chip").forEach(
      (x) => x.classList.toggle("on", x === chip));
  });

  // Selecting a site redraws both chip rows; the kitchen quick-pick
  // always shows the kitchens of the selected site.
  function pickSite(code) {
    site = code;
    // All four sites: a supervisor visiting another site logs there
    // directly; the default stays the person's own site.
    renderSiteChips($("log-sites"), site, pickSite, false, true);
  }
  pickSite(site);

  // Attachments picked now ride along after the row is created.
  const filesInput = $("log-files");
  $("log-attach").onclick = () => filesInput.click();
  const drawAttach = () => {
    const n = filesInput.files.length;
    $("log-attach-label").textContent =
      n ? fmt("media.selected", { n }) : t("media.add");
    $("log-attach").classList.toggle("has", n > 0);
  };
  filesInput.onchange = () => {
    if (filesInput.files.length > 15) { toast(t("media.limit")); filesInput.value = ""; }
    else if ([...filesInput.files].some((f) => f.size > 80 * 1024 * 1024)) {
      toast(t("media.toobig")); filesInput.value = "";
    }
    drawAttach();
  };
  drawAttach();

  const doCreate = async (btn) => {
    busy(btn, true);
    try {
      // The server collapses whitespace in the task; expect_task for the
      // follow-up upload must match what actually landed in the cell.
      const taskNorm = $("log-task").value.trim().split(/\s+/).join(" ");
      const res = await Api.addItem({
        site,
        location: $("log-loc").value,
        task: $("log-task").value,
        next_action: $("log-next").value,
        urgency,
      });
      const files = [...filesInput.files];
      if (files.length && res.row) {
        toast(fmt("media.uploading", { n: files.length }));
        await Api.uploadMedia(site, res.row, taskNorm, files);
      }
      ["log-loc", "log-task", "log-next"].forEach((id) => { $(id).value = ""; });
      filesInput.value = "";
      toast(t("log.done"));
      App.site = site;
      show("today");
      await loadToday();
    } catch (e) { handleError(e); }
    finally { busy(btn, false); }
  };

  // Deliberately no field clearing on tab entry: a half-typed draft
  // survives a detour to Today. Fields reset only after a submit.
  $("log-go").onclick = async (ev) => {
    const btn = ev.target;
    const task = $("log-task").value.trim();
    if (!task) { await doCreate(btn); return; }   // server rejects politely

    // One problem, one item: look for an open twin before creating.
    busy(btn, true);
    let dups = [];
    try {
      const fresh = await Api.items(site);
      const kOf = (txt) => ((txt || "").match(/\bK-?0*(\d+)\b/i) || [])[1] || "";
      const words = (txt) => new Set((txt || "").toLowerCase().split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2));
      const myLoc = kOf($("log-loc").value) || $("log-loc").value.trim().toLowerCase();
      const myWords = words(task);
      dups = fresh.items.filter((i) => {
        if (!i.is_open) return false;
        const loc = kOf(i.location) || (i.location || "").trim().toLowerCase();
        if (!myLoc || !loc || myLoc !== loc) return false;
        const shared = [...words(i.task)].filter((w) => myWords.has(w));
        return shared.length >= 2
          || i.task.toLowerCase().includes(task.toLowerCase())
          || task.toLowerCase().includes(i.task.toLowerCase());
      }).slice(0, 4);
    } catch { dups = []; }                       // guard must never block logging
    busy(btn, false);

    if (!dups.length) { await doCreate(btn); return; }
    openSheet((sheet) => {
      sheet.append(el("h2", "", t("dup.title")));
      sheet.append(el("p", "muted small", t("dup.hint")));
      dups.forEach((it) => {
        const card = itemCard(it, false);
        card.classList.add("duppick");
        card.addEventListener("click", () => {
          closeSheet();
          openUpdateSheet(it);
        });
        sheet.append(card);
      });
      const anyway = el("button", "btn primary", t("dup.create"));
      anyway.addEventListener("click", async () => {
        closeSheet();
        await doCreate($("log-go"));
      });
      sheet.append(anyway);
    });
  };
}

/* ---------- moves: on/offboarding dashboard ------------------------------- */

const MONTHS_UP = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function mvDateBlock(iso) {
  const d = new Date(iso + "T00:00:00");
  const box = el("div", "mv-date");
  box.append(el("span", "d", String(d.getDate())),
             el("span", "mo", MONTHS_UP[d.getMonth()]));
  return box;
}

function mvBadge(m) {
  if (m.days < 0)  return el("span", "badge stale", fmt("mv.overdue", { n: -m.days }));
  if (m.days === 0) return el("span", "badge stale", t("mv.today"));
  const cls = m.days <= 7 ? "warn" : "fresh";
  return el("span", `badge ${cls}`, fmt("mv.due", { n: m.days }));
}

function mvCard(m, showSite) {
  const c = el("div", "card mvcard " + (m.kind === "in" ? "acc-u-high" : "acc-stale"));
  c.append(mvDateBlock(m.date));
  const body = el("div", "mv-body");
  const row1 = el("div", "row1");
  row1.append(el("span", "mv-tag " + (m.kind === "in" ? "t-in" : "t-out"),
                 t(m.kind === "in" ? "mv.tag.in" : "mv.tag.out")));
  const meta = [m.kitchen || "", showSite ? m.site : ""].filter(Boolean).join(" · ");
  if (meta) row1.append(el("span", "loc-meta", meta));
  row1.append(mvBadge(m));
  body.append(row1, el("div", "title", m.company));
  c.append(body);
  return c;
}

async function renderMoves() {
  let site = App.movesSite || mySites()[0];
  const pick = (code) => {
    site = code;
    App.movesSite = code;
    renderSiteChips($("mv-sites"), site, pick, true, true);
    draw();
  };

  $("mv-list").replaceChildren(...[0, 1].map(() => {
    const li = el("li"); li.append(el("div", "skel")); return li;
  }));
  let data;
  try { data = await Api.moves(); }
  catch (e) { $("mv-list").replaceChildren(); handleError(e); return; }
  App.movesData = data;

  function draw() {
    const all = App.movesData.moves.filter(
      (m) => site === "all" || m.site === site);
    const ren = App.movesData.renewals.filter(
      (m) => site === "all" || m.site === site);

    const nIn = all.filter((m) => m.kind === "in").length;
    const nOut = all.length - nIn;
    const tile = (n, label, cls) => {
      const d = el("div", `stat ${cls}${n ? "" : " zero"}`);
      d.append(el("span", "num", String(n)), el("span", "lbl", label));
      return d;
    };
    $("mv-stats").replaceChildren(
      tile(nIn, t("mv.in"), "s-in"),
      tile(nOut, t("mv.out"), "s-stale"),
    );

    $("mv-list").replaceChildren(...all.map((m) => {
      const li = el("li");
      li.append(mvCard(m, site === "all"));
      return li;
    }));
    $("mv-empty").hidden = all.length > 0;

    const box = $("mv-renewals");
    box.replaceChildren();
    if (ren.length) {
      box.append(el("p", "listhead", t("mv.renewals")));
      box.append(el("p", "muted small", t("mv.renewals.hint")));
      ren.forEach((m) => {
        const d = new Date(m.date + "T00:00:00");
        box.append(el("p", "mv-ren",
          `${m.company}  ·  ${m.kitchen || m.site}  ·  ${d.getDate()} ${MONTHS_UP[d.getMonth()].charAt(0) + MONTHS_UP[d.getMonth()].slice(1).toLowerCase()}`));
      });
    }
  }
  pick(site);
}

/* ---------- before-leave walkthrough -------------------------------------- */

function renderLeaveIntro() {
  $("leave-intro").hidden = false;
  $("leave-walk").hidden = true;
  $("leave-done").hidden = true;
  $("leave-sites").hidden = false;
  let site = App.leave.site || mySites()[0];
  let preload = null;                    // {site, open[]} from the count fetch

  const drawCount = (n) => {
    const tile = el("div", "stat" + (n === 0 ? " zero" : ""));
    tile.append(el("span", "num", n === null ? "\u2013" : String(n)),
                el("span", "lbl", t("leave.count")));
    $("leave-stats").replaceChildren(tile);
  };

  const pick = (code) => {
    site = code;
    App.leave.site = code;
    // All four sites, like Log and Moves: a supervisor covering another
    // site must be able to run its check before going off.
    renderSiteChips($("leave-sites"), site, pick, false, true);
    drawCount(null);
    $("leave-review").hidden = true;
    const mySeq = (pick._seq = (pick._seq || 0) + 1);
    Api.items(site).then((data) => {
      if (pick._seq !== mySeq) return;
      const open = data.items.filter((i) => i.is_open);
      preload = { site, open };
      drawCount(open.length);
      const r = (data.reviews || {})[site];
      $("leave-review").textContent = r
        ? fmt("review.line", { by: r.by, when: r.when })
        : t("review.none");
      $("leave-review").hidden = false;
    }).catch(() => {});
  };
  pick(site);

  $("leave-start").onclick = async (ev) => {
    busy(ev.target, true);
    try {
      let open;
      if (preload && preload.site === site) {
        open = preload.open;             // fetched seconds ago on this screen
      } else {
        const data = await Api.items(site);
        open = data.items.filter((i) => i.is_open);
      }
      open.sort((a, b) => {
        if ((a.age_days === null) !== (b.age_days === null)) {
          return a.age_days === null ? -1 : 1;
        }
        return (b.age_days ?? 0) - (a.age_days ?? 0);
      });
      if (!open.length) {
        $("leave-intro").hidden = true;
        $("leave-done").hidden = false;
        $("leave-done-body").textContent = t("leave.empty");
        return;
      }
      App.leave.queue = open;
      App.leave.i = 0;
      $("leave-intro").hidden = true;
      $("leave-sites").hidden = true;
      $("leave-walk").hidden = false;
      leaveStep();
    } catch (e) { handleError(e); }
    finally { busy(ev.target, false); }
  };
}

function leaveStep() {
  const { queue, i } = App.leave;
  if (i >= queue.length) {
    $("leave-walk").hidden = true;
    $("leave-done").hidden = false;
    $("leave-done-body").textContent = fmt("leave.done.body", { total: queue.length });
    // Leave a trace: 'did anyone actually run the S1 check?' now has an
    // answer on everyone's Today screen.
    Api.reviewDone(App.leave.site || currentSite(), queue.length).catch(() => {});
    return;
  }
  const it = queue[i];
  $("leave-progress").textContent = fmt("leave.progress", { n: i + 1, total: queue.length });

  const holder = $("leave-card");
  holder.replaceChildren(itemCard(it, false));

  const actions = el("div", "actions");
  const advance = () => { App.leave.i += 1; leaveStep(); };
  const bU = el("button", "btn", t("item.act.update"));
  bU.addEventListener("click", () => openUpdateSheet(it, advance));
  const bH = el("button", "btn", t("item.act.handover"));
  bH.addEventListener("click", () => openHandoverSheet(it, advance));
  const bC = el("button", "btn primary", t("item.act.complete"));
  bC.addEventListener("click", () => openCompleteSheet(it, advance));
  actions.append(bU, bH, bC);
  holder.append(actions);

  $("leave-next").onclick = advance;
}

/* ---------- go ------------------------------------------------------------ */

/* Sign the person out once the app has gone IDLE_LOCK_MS without being used.
 * On a site phone that is the moment it changed hands; on a personal one it
 * costs four digits, and "Continue as" puts their name under their thumb.
 * Returns true when it locked, so callers can stop what they were doing. */
function lockIfIdle() {
  if (!session.token || session.idleMs < IDLE_LOCK_MS) return false;
  session.clear();
  App.all = null; App.items = []; App.site = ""; App.meta = null; App.roster = [];
  toast(t("err.locked"));
  enterLogin();
  return true;
}

// Any real use keeps the session alive; passive scrolling counts, because a
// person reading the list is still the person holding the phone.
["pointerdown", "keydown", "scroll"].forEach((ev) => {
  document.addEventListener(ev, () => { if (session.token) session.touch(); },
                            { passive: true });
});

// Checked on a timer as well as on return, so a phone left face-up on a
// counter locks itself instead of waiting to be picked up.
setInterval(lockIfIdle, 30 * 1000);

// A phone unlocked hours later must not show a stale handover list.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (lockIfIdle()) return;
  session.touch();
  if (session.token && !$("scr-today").hidden) loadToday();
});

boot();
