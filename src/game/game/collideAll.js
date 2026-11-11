// Car-vs-car contacts for one step. Remote cars are kinematic: they push our cars but are never pushed themselves,
// and each browser only damages the cars it simulates.
import { damageVehicle } from "@/game/vehicles/vehicle";
import { collideVehicles } from "@/game/vehicles/physics";

export function collideAll(game) {
  const vs = game.vehicles;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j];
    if (a.remote && b.remote) continue;
    const r = a.remote ? a : b.remote ? b : null;
    const keep = r && [r.pos.clone(), r.vel.clone(), r.angVel.clone()];
    collideVehicles(a, b, (victim, attacker, dmg, pt) => {
      game.particles.sparks(pt.x, pt.y, pt.z, 12);
      game.audio.impact(pt, Math.min(1, dmg / 80));
      if (!victim.remote) damageVehicle(game, victim, dmg * game.ruleSys.ramMul(victim, attacker), pt, attacker, { blunt: true });
    });
    if (r) { r.pos.copy(keep[0]); r.vel.copy(keep[1]); r.angVel.copy(keep[2]); }
  }
}