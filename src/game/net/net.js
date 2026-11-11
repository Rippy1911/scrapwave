// Network seam. `net` always wraps one implementation from rtClient.js: the loopback net (single player,
// you are the host) or the online room-server net. AI and world events run only where net.isHost() is true.
import { createOnlineNet, createLoopbackNet } from "@/game/net/rtClient";

export const SERVER_WS = "wss://scrapwake-rt.nextsolutions.studio/ws";
export const SERVER_HTTP = "https://scrapwake-rt.nextsolutions.studio";

let impl = createLoopbackNet();
let mode = "offline", peers = 1, lastWelcome = null;
impl.connect();

export const net = {
  get mode() { return mode; },
  impl: () => impl,
  isHost: () => impl.isHost(),
  myId: () => impl.myId(),
  setPeers(n) { peers = Math.max(1, n); },
  humans: () => (mode === "online" ? peers : 1),
  status: () => (mode === "online"
    ? { label: `Online · ${peers} driver${peers === 1 ? "" : "s"}`, online: true }
    : { label: "Single player", online: false }),

  // Connect within timeoutMs, else fall back to single player. Returns the welcome or null.
  // shard: ask for that shard (lobby share links); the server honours it while it has a free seat.
  welcome: () => lastWelcome,
  async goOnline({ name, vehicle, paint, shard = null }, timeoutMs = 6000) {
    const o = createOnlineNet({ url: SERVER_WS, name, vehicle, paint, shard });
    let timer = 0;
    try {
      const welcome = await Promise.race([
        o.connect(),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), timeoutMs); }),
      ]);
      clearTimeout(timer);
      impl.close();
      impl = o; mode = "online"; peers = welcome.players.length; lastWelcome = welcome;
      o.onWorld((m) => { if (m.t === "welcome") lastWelcome = m; }); // resync source after a reconnect
      return welcome;
    } catch {
      clearTimeout(timer);
      o.close();
      return null;
    }
  },
  goOffline() {
    if (mode === "offline") return;
    impl.close();
    impl = createLoopbackNet();
    impl.connect();
    mode = "offline"; peers = 1;
  },
};

export async function fetchJson(path) {
  const r = await fetch(SERVER_HTTP + path);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}