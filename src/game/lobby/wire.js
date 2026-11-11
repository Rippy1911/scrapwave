// Lobby messages over the room server exactly as it is today (docs/protocol.md; no server change):
// - every player: relayed chat events whose text starts with TAG. The server keeps chat text to 120 characters and
//   1 line per second (burst 5), so a long message is base64url JSON split into numbered chunks;
// - the shard host: ev kind "ai" (host only, free-form, up to 8 KB) carries the same message whole in `lobby`.
// Ordinary chat never shows lobby lines (net/events.js skips isLobbyText).
export const TAG = "§L";
const LINE = 118; // keep under the server's 120
const BURST = 4, REFILL_MS = 1100; // a little under the server's 1/s, burst 5

export const isLobbyText = (t) => typeof t === "string" && t.startsWith(TAG);

const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));

let midSeq = 0;
const nextMid = () => (++midSeq % 1296).toString(36);

// One message → text lines: "§L1|type|lid|body" or chunks "§Lc|type|lid|mid|i|n|part".
export function toLines(type, lid, data) {
  const body = b64(JSON.stringify(data ?? null));
  const one = `${TAG}1|${type}|${lid}|${body}`;
  if (one.length <= LINE) return [one];
  const head = `${TAG}c|${type}|${lid}|${nextMid()}|`, room = LINE - head.length - 6;
  const n = Math.ceil(body.length / room);
  return Array.from({ length: n }, (_, i) => `${head}${i}|${n}|${body.slice(i * room, (i + 1) * room)}`);
}

// Reassembles lines per sender. feed(from, text) → { type, lid, data } once a message is complete, else null.
export function createAssembler() {
  const parts = new Map();
  const decode = (type, lid, body) => { try { return { type, lid, data: JSON.parse(unb64(body)) }; } catch { return null; } };
  return {
    feed(from, text) {
      if (!isLobbyText(text)) return null;
      const f = text.slice(TAG.length).split("|");
      if (f[0] === "1" && f.length === 4) return decode(f[1], f[2], f[3]);
      if (f[0] !== "c" || f.length !== 7) return null;
      const [, type, lid, mid, si, sn, part] = f, key = `${from}:${mid}`, n = +sn;
      const now = Date.now();
      for (const [k, p] of parts) if (now - p.at > 15000) parts.delete(k);
      let p = parts.get(key);
      if (!p || p.n !== n || p.type !== type) parts.set(key, (p = { type, lid, n, got: new Array(n), count: 0, at: now }));
      if (p.got[+si] === undefined) { p.got[+si] = part; p.count++; }
      if (p.count < p.n) return null;
      parts.delete(key);
      return decode(type, lid, p.got.join(""));
    },
  };
}

// Paces outgoing chat lines under the server's limit. push(lines, key): a newer group with the same key replaces
// one still waiting (a fresh snapshot makes an unsent old one useless).
export function createChatQueue(send) {
  let tokens = BURST, last = Date.now(), q = [];
  const pump = () => {
    const now = Date.now();
    tokens = Math.min(BURST, tokens + (now - last) / REFILL_MS);
    last = now;
    while (q.length && tokens >= 1) {
      const item = q.shift();
      if (send(item.line) === false) { q.unshift(item); break; }
      tokens -= 1;
    }
  };
  const timer = setInterval(pump, 200);
  return {
    push(lines, key = null) {
      // A group cut short leaves receivers a partial message; it expires there and the newer one follows.
      if (key) q = q.filter((x) => x.key !== key);
      for (const line of lines) q.push({ line, key });
      pump();
    },
    size: () => q.length,
    clear() { q = []; },
    dispose() { clearInterval(timer); q = []; },
  };
}