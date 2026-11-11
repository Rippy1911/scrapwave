// Server and client fame checks: totals only rise; hourly gain is capped.

import { TRACKS } from "@/game/fame/titles";

export const FAME_HOUR_CAP = 600;

export function fameTotals(fame) {
  const out = {};
  for (const t of TRACKS) out[t.id] = Math.max(0, Math.round(fame?.[t.id] || 0));
  return out;
}

export function sumFame(fame) {
  return TRACKS.reduce((s, t) => s + (fame?.[t.id] || 0), 0);
}

/** Returns { ok, reason } */
export function validateFameUpdate(prev, next, hour = null) {
  const a = fameTotals(prev);
  const b = fameTotals(next);
  for (const t of TRACKS) {
    if (b[t.id] < a[t.id]) return { ok: false, reason: `fame_${t.id}_dropped` };
  }
  if (hour && typeof hour === "object") {
    const gained = sumFame(b) - sumFame(a);
    const bucket = Math.max(0, Math.round(hour.gained || 0)) + gained;
    if (bucket > FAME_HOUR_CAP) return { ok: false, reason: "fame_hour_cap" };
  }
  return { ok: true };
}

export function mergeFameLocal(local, remote) {
  const out = fameTotals(local);
  const r = fameTotals(remote);
  for (const t of TRACKS) out[t.id] = Math.max(out[t.id], r[t.id]);
  return out;
}
