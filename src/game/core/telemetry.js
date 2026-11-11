// Crash reports (ClientError) and play events (PlayEvent), queued here and sent in one batch through sendTelemetry
// (src/lib/server-fns.js): at most one request every 60 s, plus one when the page is hidden for good (pagehide).
// Base44 allows about 100 requests a minute per user and the game needs those, so nothing is sent per event.
// Nothing in here throws or logs: a failed send is dropped. No personal data: only the game's own context goes
// out, and Base44 stamps the signed-in user's id on the records when there is one.
// Scripted runs (?autoplay, ?test, ?selfcheck, ?mechcheck, ?accel) still queue but never send.
// window.scrapwake.telemetry: state() reads the queue and counters, flush() sends now (still once a minute at most).
import { sendTelemetry } from "@/lib/server-fns";
import { VERSION } from "@/game/data/tuning";
import { getRules } from "@/game/rules/state";

const EVERY = 60000, MAX_ERRORS = 5, MAX_EVENTS = 30, STACK_LINES = 5, OPEN = "open_world";
const T = {
  game: null, enabled: true, errors: [], events: [], seen: new Map(), errorTotal: 0, once: new Set(),
  requests: 0, ok: 0, failed: 0, lastSend: 0, lastResult: null, lastBatch: null, timer: null,
};

const iso = () => new Date().toISOString();
const browser = (() => {
  try {
    const ua = navigator.userAgent;
    for (const [tok, name] of [["Edg", "Edge"], ["OPR", "Opera"], ["SamsungBrowser", "Samsung"], ["Firefox", "Firefox"], ["FxiOS", "Firefox"], ["CriOS", "Chrome"], ["Chrome", "Chrome"]]) {
      const m = new RegExp(tok + "/(\\d+)").exec(ua);
      if (m) return `${name} ${m[1]}`;
    }
    const s = /Version\/(\d+).*Safari/.exec(ua);
    return s ? `Safari ${s[1]}` : "other";
  } catch { return "other"; }
})();

// The context every record carries: version, quality preset and the rules being played.
function context() {
  const g = T.game, out = { version: String(VERSION) };
  try { out.quality = String((g && (g.rend.quality || g.save.quality)) || "").slice(0, 16) || undefined; } catch { /* not booted */ }
  try { out.mode = String(getRules().name).slice(0, 40); } catch { /* no rules yet */ }
  return out;
}
const device = () => { try { return T.game && T.game.touch.enabled() ? "touch" : "desktop"; } catch { return "desktop"; } };

function reportError(message, stack) {
  try {
    message = String(message || "").trim().slice(0, 300);
    if (!message || message === "Script error.") return; // cross-origin scripts hide everything else
    let lines = String(stack || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length && message.includes(lines[0].replace(/^\w*Error:\s*/, "").slice(0, 60))) lines = lines.slice(1); // Chrome repeats the message
    lines = lines.slice(0, STACK_LINES);
    const key = message + "|" + (lines[0] || "");
    const dup = T.seen.get(key);
    if (dup) { dup.count = Math.min(10000, dup.count + 1); return; }
    if (T.errorTotal >= MAX_ERRORS) return;
    T.errorTotal++;
    const row = { message, stack: lines.join("\n").slice(0, 1200) || undefined, count: 1, ...context(), browser, time: iso() };
    T.seen.set(key, row);
    T.errors.push(row);
  } catch { /* reporting must never break the game */ }
}

export function playEvent(kind, fields = {}) {
  try {
    if (T.events.length >= MAX_EVENTS) return;
    const row = { kind, ...context(), device: device(), session_seconds: Math.round(performance.now() / 1000), time: iso() };
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== "") row[k] = typeof v === "string" ? v.slice(0, 40) : v;
    T.events.push(row);
  } catch { /* ignore */ }
}
const playOnce = (kind, fields) => { if (T.once.has(kind)) return; T.once.add(kind); playEvent(kind, fields); };

// Called by game.js: when play starts (title buttons, Custom Game, online), and on every throttle input (only the
// first one counts).
export function modePicked(game = T.game) {
  try {
    const r = getRules(), a = game && game.arena;
    playEvent("mode_pick", { mode: r.name, map: a && a.active && a.map ? a.map.name : OPEN });
  } catch { /* ignore */ }
}
export const firstDrive = () => { if (!T.once.has("first_drive")) playOnce("first_drive", { first_drive_ms: Math.round(performance.now()) }); };

function matchEnd(e) {
  try {
    if (!e) return;
    if (e.type === "arenaResults" && e.data) playEvent("match_end", { mode: e.data.rules, map: e.data.map, result: e.data.won ? "won" : "lost", match_seconds: Math.max(0, Math.round(+e.data.time || 0)) });
    else if (e.type === "results") playEvent("match_end", { map: OPEN, result: "cycle_end", match_seconds: Math.max(0, Math.round(T.game.cycle.t)) });
  } catch { /* ignore */ }
}

async function send(final = false) {
  if (!T.enabled) return { skipped: "disabled" };
  if (!T.errors.length && !T.events.length) return { skipped: "empty" };
  const now = Date.now();
  if (!final && T.lastSend && now - T.lastSend < EVERY) return { skipped: "rate", waitMs: EVERY - (now - T.lastSend) };
  const data = { errors: T.errors.splice(0, 5), events: T.events.splice(0, MAX_EVENTS) };
  T.lastSend = now; T.requests++;
  T.lastBatch = { errors: data.errors.length, events: data.events.length, kinds: data.events.map((e) => e.kind) };
  try {
    // keepalive lets the last batch finish after the page is gone
    await sendTelemetry({ data, ...(final ? { fetch: (url, init) => fetch(url, { ...init, keepalive: true }) } : {}) });
    T.ok++; T.lastResult = "ok";
  } catch {
    T.failed++; T.lastResult = "failed"; // dropped: telemetry never retries into the rate limit
  }
  return { sent: T.lastBatch, result: T.lastResult };
}
const flush = () => send(false).catch(() => ({ result: "failed" }));

function onHide() {
  try {
    playOnce("session_end", { session_seconds: Math.round(performance.now() / 1000) });
    send(true).catch(() => {});
  } catch { /* ignore */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => reportError(e.message || (e.error && e.error.message), e.error && e.error.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    reportError(r && r.message ? r.message : "Unhandled rejection: " + (() => { try { return String(r); } catch { return "?"; } })(), r && r.stack);
  });
  window.addEventListener("pagehide", onHide);
}

// Hooks the running game in: its context, match ends (from the results events), session_start and the 60 s timer.
// Returns the detach function game.js runs on dispose.
export function attachTelemetry(game) {
  try {
    T.game = game;
    T.enabled = !game.noSave;
    const emit = game.emit;
    game.emit = (e) => { matchEnd(e); return emit(e); };
    playOnce("session_start");
    if (!T.timer) T.timer = setInterval(flush, EVERY);
  } catch { /* ignore */ }
  return () => { if (T.game === game) T.game = null; };
}

export const telemetryHooks = () => ({
  telemetry: {
    state: () => ({
      enabled: T.enabled, queued: { errors: T.errors.length, events: T.events.length },
      errors: T.errors.map((x) => ({ ...x })), events: T.events.map((x) => ({ ...x })),
      errorsThisSession: T.errorTotal, requests: T.requests, ok: T.ok, failed: T.failed, lastResult: T.lastResult,
      lastBatch: T.lastBatch, lastSendAgoMs: T.lastSend ? Date.now() - T.lastSend : null,
    }),
    flush,
  },
});
