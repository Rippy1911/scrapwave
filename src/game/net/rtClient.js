// Scrapwake browser net module. Plain ES module, no dependencies.
//   createOnlineNet({ url, name, vehicle, paint })  WebSocket client for the room server
//   createLoopbackNet({ name, vehicle, paint })     in-memory stand-in for single player
// Both expose the OfflineNet seam (connect, isHost, sendState, onSnapshot, sendEvent,
// onEvent) plus myId, shard, sendAi, onHost, onWorld, onClose, close and rtt.
// Message formats: protocol.md.
import { session } from "@/game/core/safeStorage";

const WORLD_OUT = new Set(["claim", "build", "modHit", "siphon", "spawnCrate", "job"]);
const BACKOFF_MS = [1000, 2000, 4000, 8000, 8000]; // five tries, then give up
const NO_RETRY = new Set([4001, 4002]); // replaced by a newer tab; wrong protocol version
const AI_CHUNK_BYTES = 7000; // the server closes sockets that send messages over 8 KB
const AI_CHUNK_ITEMS = 64;

function emitter() {
  const subs = new Map();
  return {
    on(kind, cb) {
      if (!subs.has(kind)) subs.set(kind, new Set());
      subs.get(kind).add(cb);
      return () => subs.get(kind).delete(cb);
    },
    emit(kind, v) {
      for (const cb of subs.get(kind) || []) {
        try { cb(v); } catch (e) { console.error("[net]", kind, e); }
      }
    },
  };
}

/** The five subscription methods; each returns an unsubscribe function. */
const listeners = (bus) => ({
  onSnapshot: (cb) => bus.on("snap", cb),
  onEvent: (cb) => bus.on("event", cb),
  onHost: (cb) => bus.on("host", cb),
  onWorld: (cb) => bus.on("world", cb),
  onClose: (cb) => bus.on("close", cb),
});

/** One id per browser tab: survives reloads (so a reload resumes), never shared by tabs. */
function tabSession() {
  const key = "scrapwake.session";
  let s = session.get(key);
  if (!s) session.set(key, (s = crypto.randomUUID()));
  return s;
}

/** Trailing throttle: at most one call per `ms`, always delivering the latest value. */
function throttle(ms, fn) {
  let last = 0, pending = null, timer = 0;
  const flush = () => {
    const v = pending;
    timer = 0;
    pending = null;
    last = performance.now();
    if (v !== null) fn(v);
  };
  return (v) => {
    pending = v;
    if (timer) return;
    const wait = last + ms - performance.now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };
}

export function createOnlineNet({
  url, name = "Driver", vehicle = "jackal", paint = "rust",
  shard = null, sessionId = null, WebSocketImpl = null,
} = {}) {
  const WS = WebSocketImpl || globalThis.WebSocket;
  const bus = emitter();
  const session = sessionId || tabSession();
  let ws = null, me = null, hostId = null, shardId = shard, welcomed = false, noRetry = false;
  let userClosed = false, tries = 0, rttMs = 0, pingTimer = 0, retryTimer = 0, seq = 0;
  let pending = null; // { resolve, reject } until the first welcome

  const raw = (o) => !!ws && ws.readyState === 1 && (ws.send(typeof o === "string" ? o : JSON.stringify(o)), true);
  const ping = () => raw({ t: "ping", ts: performance.now() });

  function open() {
    const sock = (ws = new WS(url));
    sock.onopen = () =>
      raw({ t: "hello", v: 1, name, vehicle, paint, sessionId: session, shard: shardId || undefined });
    sock.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) { console.error("[net] bad message", err); }
    };
    sock.onclose = (e) => onDrop(sock, e.code, e.reason);
    sock.onerror = () => {};
  }

  function onMessage(m) {
    switch (m.t) {
      case "snap": return bus.emit("snap", m);
      case "ev": return bus.emit("event", m);
      case "ping": return void raw({ t: "pong", ts: m.ts });
      case "pong": {
        const sample = performance.now() - m.ts;
        return void (rttMs = rttMs ? rttMs * 0.8 + sample * 0.2 : sample);
      }
      case "host": return bus.emit("host", (hostId = m.hostId));
      case "bye": // sent before the server closes us; its code survives a lost close frame
        if (NO_RETRY.has(m.code)) noRetry = true;
        return bus.emit("world", m);
      case "welcome": {
        const first = !welcomed, hostChanged = hostId !== m.hostId;
        [welcomed, tries, me, shardId, hostId] = [true, 0, m.you, m.shard, m.hostId];
        clearInterval(pingTimer);
        pingTimer = setInterval(ping, 2000);
        ping();
        if (!first) bus.emit("world", m); // resumed after a reconnect: resync from m.world
        pending?.resolve(m);
        pending = null;
        if (!first && hostChanged) bus.emit("host", hostId);
        return;
      }
      default:
        return bus.emit("world", m);
    }
  }

  function onDrop(sock, code, reason) {
    if (sock !== ws) return;
    ws = null;
    clearInterval(pingTimer);
    const giveUp = userClosed || noRetry || NO_RETRY.has(code) || tries >= BACKOFF_MS.length;
    bus.emit("close", { code, reason, reconnecting: !giveUp });
    if (!giveUp) return void (retryTimer = setTimeout(open, BACKOFF_MS[tries++] * (0.8 + Math.random() * 0.4)));
    pending?.reject(new Error(`connect failed (code ${code})`));
    pending = null;
  }

  const pushState = throttle(50, (s) => raw({ ...s, t: "s", seq: ++seq }));
  const pushAi = throttle(1000 / 15, (list) => {
    let chunk = [], size = 0;
    const flush = () => (chunk.length && raw(`{"t":"ai","list":[${chunk.join(",")}]}`), (chunk = []), (size = 0));
    for (const a of list) {
      const j = JSON.stringify(a);
      if (size + j.length > AI_CHUNK_BYTES || chunk.length >= AI_CHUNK_ITEMS) flush();
      chunk.push(j);
      size += j.length + 1;
    }
    flush();
  });
  const isHost = () => me !== null && me === hostId;

  return {
    connect() {
      if (ws) return Promise.reject(new Error("already connected"));
      [userClosed, noRetry, tries] = [false, false, 0];
      return new Promise((resolve, reject) => ((pending = { resolve, reject }), open()));
    },
    isHost,
    myId: () => me,
    shard: () => shardId,
    rtt: () => Math.round(rttMs * 10) / 10,
    /** Throttled to 20 Hz; the latest state wins. */
    sendState: (state) => !!ws && (pushState(state), true),
    /** Host only. Throttled to 15 Hz and split into messages under 8 KB. */
    sendAi: (list) => !!ws && isHost() && (pushAi(list), true),
    /** `ev` kinds go out as {t:"ev",kind,...}; world actions (claim, build, ...) as {t:kind,...}. */
    sendEvent(kind, data = {}) {
      return WORLD_OUT.has(kind) ? raw({ ...data, t: kind }) : raw({ ...data, t: "ev", kind });
    },
    ...listeners(bus),
    close() {
      userClosed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      if (!ws) return bus.emit("close", { code: 1000, reason: "bye", reconnecting: false });
      raw({ t: "bye" });
      ws.close(1000, "bye");
    },
  };
}

/**
 * In-memory net for single player and tests: you are always the host, events are not
 * echoed (nobody else is there), world actions are confirmed asynchronously without
 * cost checks (the offline game keeps its own economy).
 */
export function createLoopbackNet({
  name = "Driver", vehicle = "jackal", paint = "rust", cycleMs = 1_800_000, stormMs = 300_000,
} = {}) {
  const bus = emitter();
  const me = "local", crates = new Map(), owners = new Map();
  let open = false, modSeq = 0;
  const world = {
    spawnCrate: (d) => (crates.set(d.id, d), { ...d, t: "spawnCrate" }),
    claim(d) {
      const by = d.ai || me;
      if (owners.has(d.plot)) return { t: "no", what: "claim", reason: "taken", plot: d.plot };
      if ([...owners.values()].includes(by)) return { t: "no", what: "claim", reason: "onePlot", plot: d.plot };
      owners.set(d.plot, by);
      return { t: "claim", plot: d.plot, by, name: d.name || name };
    },
    build: (d) => ({
      t: "build", plot: d.plot, by: d.ai || me,
      mod: { id: `m${++modSeq}`, module: d.module, x: d.x, z: d.z, rot: d.rot || 0 },
    }),
    modHit: (d) => ({ ...d, t: "modHit", by: d.src || me }),
    siphon: (d) => ({ t: "siphon", plot: d.plot, by: d.ai || me, amount: 0 }),
    job: (d) => ({ ...d, t: "job" }),
    loot(d) {
      const c = crates.get(d.crateId);
      crates.delete(d.crateId);
      return c
        ? { t: "lootOk", crateId: d.crateId, scrap: c.scrap, part: c.part }
        : { t: "lootNo", crateId: d.crateId, reason: "gone" };
    },
  };
  return {
    connect() {
      open = true;
      const now = Date.now();
      return Promise.resolve({
        t: "welcome", v: 1, you: me, shard: "local", hostId: me,
        cycle: { n: 1, startedAt: now, durationMs: cycleMs, stormMs, now, phase: "run" },
        players: [{ id: me, name, vehicle, paint }],
        world: { plots: [], crates: [], jobs: [] },
        wallet: { bank: 0, banked: 0, plot: null, stash: 0 },
      });
    },
    isHost: () => true, myId: () => me, shard: () => "local", rtt: () => 0,
    sendState: () => open, sendAi: () => open,
    sendEvent(kind, data = {}) {
      if (!open) return false;
      if (Object.hasOwn(world, kind)) {
        const reply = world[kind](data);
        queueMicrotask(() => bus.emit("world", reply));
      }
      return true;
    },
    ...listeners(bus),
    close() {
      if (!open) return;
      open = false;
      queueMicrotask(() => bus.emit("close", { code: 1000, reason: "bye", reconnecting: false }));
    },
  };
}
