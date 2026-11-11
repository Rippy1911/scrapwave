// Joining: find the lobby for an id or a code among the lobbies heard in this shard, then send the join and wait
// for the host's answer (a snapshot that lists us, or a refusal).
import { codeHash } from "@/game/lobby/describe";
import { normCode } from "@/game/lobby/lobbyState";

const ID = /^L[A-Z0-9]{6}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// list: Map lid → beacon entry. Waits up to waitMs for a beacon (hosts repeat theirs every 5 s).
export async function resolveTarget(list, q, code = "", waitMs = 7000) {
  const raw = String(q || "").trim(), up = raw.toUpperCase();
  const t0 = Date.now();
  for (;;) {
    const byId = list.get(up);
    if (byId) return { lid: byId.id, code: normCode(code), entry: byId };
    const h = codeHash(up);
    const byCode = h && [...list.values()].find((b) => b.locked && b.codeHash === h);
    if (byCode) return { lid: byCode.id, code: normCode(up), entry: byCode };
    if (Date.now() - t0 > waitMs) break;
    await sleep(400);
  }
  if (ID.test(up)) return { lid: up, code: normCode(code), entry: null }; // a share link's lobby not heard yet
  return null;
}

// st.pending is settled by the lobby core (snapshot with us in it → ok, "no" to us → refused).
export function waitForJoin(st, lid, send, timeoutMs = 11000) {
  return new Promise((resolve) => {
    let again = 0, fail = 0;
    const done = (r) => {
      clearTimeout(again); clearTimeout(fail);
      if (st.pending && st.pending.lid === lid) st.pending = null;
      resolve(r);
    };
    again = setTimeout(send, 4000); // a chunk lost on the way: ask once more
    fail = setTimeout(() => done({ ok: false, reason: "No answer from that lobby's host" }), timeoutMs);
    st.pending = { lid, done };
    send();
  });
}