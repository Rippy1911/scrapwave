// Share links (?lobby=<id>&shard=<shard>&code=<code>) and the tab's current lobby, kept in sessionStorage so a
// reload or a dropped connection rejoins the same lobby (the room server gives the same player id back within
// its 60 s grace; after that the host matches the returning player by name while their seat is held).
import { session } from "@/game/core/safeStorage";
const KEY = "scrapwake.lobby";

export function rememberLobby(info) {
  if (info) session.setJSON(KEY, info); else session.remove(KEY);
}
export function lastLobby() {
  const v = session.getJSON(KEY, null);
  return v && v.id ? v : null;
}

export function lobbyLink({ id, shard, code }) {
  const u = new URL(window.location.href);
  for (const k of ["rules", "preset", "lobby", "shard", "code"]) u.searchParams.delete(k);
  u.searchParams.set("lobby", id);
  if (shard) u.searchParams.set("shard", shard);
  if (code) u.searchParams.set("code", code);
  return u.toString();
}

// The lobby this page was opened for: a share link first, else the lobby this tab was in before a reload.
export function linkedLobby() {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("lobby");
  if (id) return { id: id.slice(0, 12), shard: (q.get("shard") || "").slice(0, 24) || null, code: (q.get("code") || "").slice(0, 12), via: "link" };
  const last = lastLobby();
  return last ? { ...last, via: "rejoin" } : null;
}