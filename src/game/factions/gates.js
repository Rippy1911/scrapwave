// Town gates: a faction that is Hostile to you shuts its town. Its safe zone stops protecting you, and your car is
// turned back at the ring (inward speed removed, a shove outward). Already inside when it turns? You are eased out.
import { GATES, FACTION } from "@/game/factions/roster";

const SHOVE = 6, WARN_EVERY = 4;

export function createGates(game, rep) {
  let warnAt = -99;

  const shutZone = (x, z, margin = 0) => {
    const zone = game.onfoot.zones.at(x, z, -margin);
    const fid = zone && GATES[zone.id];
    return fid && rep.hostile(fid) ? { zone, fid } : null;
  };

  // The player is never "safe" inside a shut town.
  const inSafe = game.inSafeZone;
  game.inSafeZone = (v) => (v === game.player && !game.arena.active && shutZone(v.pos.x, v.pos.z) ? false : inSafe(v));

  function step() {
    const p = game.player;
    if (!p.alive || p.air || game.arena.active || game.onfoot.active()) return;
    const hit = shutZone(p.pos.x, p.pos.z, 3);
    if (!hit) return;
    const { zone, fid } = hit;
    const dx = p.pos.x - zone.x, dz = p.pos.z - zone.z, d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d, inward = -(p.vel.x * nx + p.vel.z * nz);
    if (inward > 0) { p.vel.x += nx * inward; p.vel.z += nz * inward; }
    const k = d > zone.r - 6 ? SHOVE : SHOVE * 0.4; // near the ring: a firm shove; deep inside: eased out
    p.vel.x += nx * k * 0.1; p.vel.z += nz * k * 0.1;
    if (game.time - warnAt > WARN_EVERY) {
      warnAt = game.time;
      game.callout("GATE SHUT", `${FACTION[fid].name} is Hostile`, "#ff5a3c");
    }
  }

  return { step, shut: (zoneId) => { const fid = GATES[zoneId]; return !!fid && rep.hostile(fid); }, shutAt: shutZone };
}