// May the driver climb out here? Inside a safe zone the old rule stands (stopped, under 4 km/h). Anywhere else in
// free roam: wheels on the ground and slower than FOOT.exitKmh. A car with a working harpoon fires it on E, so
// outside a zone it only lets you out when stopped, and says nothing when it does not. Arenas, races, the demo,
// the autopilot and aircraft never get this far (onfoot.js driveOnly).
import { FOOT } from "@/game/onfoot/footGear";
import { STOPPED_KMH } from "@/game/onfoot/zones";

const kmhOf = (v) => Math.hypot(v.vel.x, v.vel.y, v.vel.z) * 3.6;
const hasHarpoon = (v) => (v.weapons || []).some((w) => !w.disabled && (w.group ? w.group === "aux" : w.def && w.def.kind === "harpoon"));

// Returns { ok, why }: why is the line the HUD shows (null: refuse quietly).
export function exitCheck(game, zone) {
  const p = game.player, kmh = kmhOf(p);
  if (!p.alive) return { ok: false, why: null };
  if (zone) return kmh <= STOPPED_KMH ? { ok: true, why: null } : { ok: false, why: "STOP TO GET OUT IN A SAFE ZONE" };
  const harpoon = hasHarpoon(p), limit = harpoon ? STOPPED_KMH : FOOT.exitKmh;
  if (!p.contacts && !p.walking) return { ok: false, why: harpoon ? null : "CAN'T GET OUT IN THE AIR" };
  if (kmh >= limit) return { ok: false, why: harpoon ? null : `TOO FAST TO GET OUT · SLOW BELOW ${FOOT.exitKmh} KM/H` };
  return { ok: true, why: null };
}