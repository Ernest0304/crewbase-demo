/* 值班交接 App — every user-facing string, and nothing else.
 *
 * English-only (your manager, 10 Aug 2026 — the bilingual layer was removed
 * for a cleaner, more professional UI). Layout code never hardcodes
 * copy; it looks up a key here. Read every line aloud before shipping.
 */
"use strict";

const COPY = {
  // ---- app chrome -----------------------------------------------------
  "app.title":        "CrewBASE",
  "app.sub":          "Site Handover & Tasks",
  "app.by":           "by Smart City Kitchens",
  "nav.today":        "Today",
  "nav.log":          "Log",
  "nav.leave":        "Handover",
  "nav.moves":        "Moves",
  "common.cancel":    "Cancel",
  "common.back":      "Back",
  "common.retry":     "Retry",
  "common.offline":   "No connection — try again shortly",
  "common.logout":    "Log out",
  "sheet.close":      "Close",

  // ---- login ----------------------------------------------------------
  // One person on a personal phone reads as an invitation; several on a site
  // handset read as a list to pick from. Same block, different promise.
  "login.recent.one": "Continue as",
  "login.recent.many": "Recent on this device",
  "login.recent.used": "last used {when}",
  "login.recent.forget": "Forget {name} on this device",
  "when.now":         "just now",
  "when.mins":        "{n}m ago",
  "when.hours":       "{n}h ago",
  "when.days":        "{n}d ago",

  "login.title":      "Pick your name",
  "login.search":     "Search names",
  "login.empty":      "The roster is empty. New here? Register below.",
  "login.nomatch":    "No name matches — check the spelling.",
  "login.register":   "New here? Register",
  "login.pin.title":  "Enter your PIN",
  "login.pin.go":     "Log in",
  "login.pin.wrong":  "That PIN is not right — try again.",
  "login.pin.forgot": "Forgot your PIN? Ask your manager to reset it, then set a new one here.",

  // ---- first-login PIN claim ------------------------------------------
  "claim.title":      "First login — set a PIN",
  "claim.hint":       "Choose 4 digits. You will use them to log in from now on.",
  "claim.pin":        "New PIN",
  "claim.pin2":       "Type it again",
  "claim.mismatch":   "The two entries do not match — try again.",
  "claim.go":         "Set PIN and log in",

  // ---- register -------------------------------------------------------
  "reg.title":        "Register",
  "reg.name":         "Full name",
  "reg.name.ph":      "e.g. Aisha Rahman",
  "reg.sites":        "Which sites do you work at?",
  "reg.sites.cap":    "More than 3 sites needs a manager's approval before you can log in.",
  "reg.pending.title": "Almost there",
  "reg.pending.body": "A manager needs to approve your access. Your name will appear on the login screen once they do.",
  "reg.pending.ok":   "Got it",
  "reg.role":         "Role (optional)",
  "reg.role.ph":      "e.g. Runner",
  "reg.pin":          "Choose a 4-digit PIN",
  "reg.pin2":         "Type it again",
  "reg.go":           "Register and log in",
  "reg.exists.title": "This name is already registered",
  "reg.exists.login": "That is me — log in",
  "reg.exists.dup":   "Same name, different person — register anyway",

  // ---- today ----------------------------------------------------------
  "greet.morning":    "Good morning",
  "greet.afternoon":  "Good afternoon",
  "greet.evening":    "Good evening",
  "today.sub":        "{n} open at {site}",
  "today.sub.all":    "{n} open across all sites",
  "today.section":    "Handover items",
  "today.search":     "Search kitchen or task",
  "today.all":        "All",
  "seg.open":         "Open",
  "seg.hold":         "On hold",
  "seg.done":         "Done",
  "stats.open":       "Open",
  "stats.stale":      "Over 7d",
  "stats.undated":    "No date",
  "today.undated":    "No date",
  "today.empty":      "Nothing here — all clear",
  "today.nomatch":    "Nothing matches your search.",
  "today.touched":    "You updated this before",

  // ---- urgency ---------------------------------------------------------
  "urg.label":        "Urgency",
  "urg.hint":         "How soon must this be resolved?",
  "urg.overdue":      "Overdue {n}d",
  "urg.due.today":    "Due today",
  "urg.left":         "{n}d left",
  "urg.within":       "resolve within {n} days",

  // ---- today: sections + freshness ------------------------------------
  "sec.handed":       "Handed to you",
  "sec.open":         "Open items",
  "new.badge":        "Updated",
  "new.count":        "{n} updated since your last visit",
  "review.line":      "Last handover check: {by} \u00b7 {when}",
  "review.none":      "No handover check recorded yet",

  // ---- duplicate guard -------------------------------------------------
  "dup.title":        "Similar open items",
  "dup.hint":         "One problem should live on one item \u2014 updating the existing one keeps its history together.",
  "dup.create":       "Create a new item anyway",

  // ---- media -----------------------------------------------------------
  "media.label":      "Photos & videos",
  "media.add":        "Add photos / videos",
  "media.selected":   "{n} selected",
  "media.uploading":  "Uploading {n} file(s)\u2026",
  "media.limit":      "An item can hold at most 15 photos and videos.",
  "media.toobig":     "Each file must be under 80 MB.",

  // ---- item detail ----------------------------------------------------
  "item.trail":       "Updates",
  "item.reported":    "Reported",
  "item.completed":   "Completed",
  "item.lastby":      "Last update",
  "item.trail.none":  "No updates yet.",
  "item.next":        "Next action",
  "item.act.update":  "Update",
  "item.act.complete":"Complete",
  "item.act.handover":"Hand over",

  // ---- update sheet ---------------------------------------------------
  "upd.title":        "Update",
  "upd.note":         "What's new?",
  "upd.note.ph":      "e.g. technician came, waiting for a part",
  "upd.next":         "Next action (editable)",
  "upd.status":       "Status",
  "upd.st.progress":  "In progress",
  "upd.st.hold":      "On hold",
  "upd.save":         "Save update",
  "upd.saved":        "Saved",
  "upd.conflict":     "Someone else just edited this item. The list has been refreshed — try again.",

  // ---- complete sheet -------------------------------------------------
  "cpl.title":        "Mark as completed",
  "cpl.note":         "How was it resolved?",
  "cpl.note.ph":      "e.g. technician replaced the timer plug, tested OK",
  "cpl.required":     "Describe how it was resolved before completing.",
  "cpl.confirm":      "Confirm completion",
  "cpl.done":         "Completed",

  // ---- handover sheet -------------------------------------------------
  "ho.title":         "Who picks this up?",
  "ho.hint":          "Whoever works next owns this item. Pick a name or type one.",
  "ho.free.ph":       "e.g. day shift, contractor",
  "ho.note":          "Leave a note (optional)",
  "ho.go":            "Hand over",
  "ho.done":          "Handed over",

  // ---- log a new item -------------------------------------------------
  "log.kicker":       "New report",
  "log.title":        "Log an item",
  "log.sub":          "Thirty seconds: what happened, where, and how urgent.",
  "log.site":         "Which site?",
  "log.loc":          "Location",
  "log.loc.ph":       "e.g. corridor, or tap the grid",
  "log.task":         "What happened?",
  "log.task.ph":      "e.g. K26 coldroom door does not seal",
  "log.next":         "Next action (optional)",
  "log.next.ph":      "e.g. waiting for Mirakn to reply",
  "log.go":           "Submit",
  "log.done":         "Logged",

  // ---- before-leave walkthrough --------------------------------------
  "leave.kicker":     "Before you go",
  "leave.heading":    "Handover check",
  "leave.sub":        "Update, hand over, or confirm every open item before your leave or off day.",
  "leave.count":      "Open items to review",
  "leave.title":      "Before you go, walk through the open items",
  "leave.intro":      "Thirty seconds before your leave or off day: update each open item, hand it over, or confirm it is unchanged.",
  "leave.start":      "Start",
  "leave.progress":   "Item {n} of {total}",
  "leave.unchanged":  "Unchanged — next",
  "leave.empty":      "Nothing open at this site — off you go",
  "leave.done.title": "Handover complete",
  "leave.done.body":  "All {total} items reviewed. Enjoy your time off!",

  // ---- moves (on/offboarding dashboard) --------------------------------
  "mv.kicker":        "Licensee schedule",
  "mv.title":         "Move-ins & move-outs",
  "mv.sub":           "Schedule onboarding and offboarding with the licensee ahead of these dates.",
  "mv.in":            "Moving in",
  "mv.out":           "Moving out",
  "mv.tag.in":        "IN",
  "mv.tag.out":       "OUT",
  "mv.today":         "Today",
  "mv.due":           "in {n}d",
  "mv.overdue":       "{n}d overdue",
  "mv.renewals":      "Renewals — no handover needed",
  "mv.renewals.hint": "These contracts ended and the same licensee continues in the same kitchen.",
  "mv.empty":         "No moves in the next 90 days.",

  // ---- errors ----------------------------------------------------------
  "err.session":      "Your session has expired — log in again.",
  "err.locked":       "Locked after 5 minutes idle — tap your name to carry on.",
  "err.generic":      "Something went wrong — try again.",
};

/* t('key') -> string; a missing key returns the key itself so the gap
 * is visible on screen, not fatal. */
function t(key) {
  return COPY[key] !== undefined ? COPY[key] : key;
}

function fillCopy(root) {
  root.querySelectorAll("[data-copy]").forEach((el) => {
    el.textContent = t(el.dataset.copy);
  });
  root.querySelectorAll("[data-copy-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.copyPh);
  });
}
