// Best laps, kept in this browser per track: { time, splits, car, ghost: { hz, data } } (race/ghost.js).
// Storage can be full or switched off (private windows): then the best lap simply lasts for the session.
const key = (trackId) => `scrapwake.bestlap.${trackId}`;
const session = new Map();

export function loadBest(trackId) {
  if (session.has(trackId)) return session.get(trackId);
  let rec = null;
  try { rec = JSON.parse(window.localStorage.getItem(key(trackId))); } catch { rec = null; }
  if (!rec || typeof rec.time !== "number") rec = null;
  session.set(trackId, rec);
  return rec;
}

export function saveBest(trackId, rec) {
  session.set(trackId, rec);
  try { window.localStorage.setItem(key(trackId), JSON.stringify(rec)); } catch { /* kept for the session only */ }
}