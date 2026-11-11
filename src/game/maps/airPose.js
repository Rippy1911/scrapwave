// Aircraft in a world map (round 15): a map whose layout has an `air` list (poses: name, x, z, y, heading) lets you fly
// inside its match. A jet starts on the nearest runway pose and a helicopter on the nearest helipad, both on the map's
// deck; a map without the list keeps the old rule (no aircraft in an arena).
import { FLIGHT } from "@/game/air/flight";

const layoutOf = (game) => (game.arena && game.arena.active && game.arena.map && game.arena.map.layout) || null;
export const mapAirAllowed = (game) => { const L = layoutOf(game); return !!(L && L.air && L.air.length); };

// Where a craft may fly: the free-roam square, or inside the ring of a world map that lets you fly (its deck can stand
// past the roam world's edge, so the square would cut the map short).
export function clampAir(game, pos, bound) {
  const c = mapAirAllowed(game) && game.arena.map && game.arena.map.ctx;
  if (!c) { pos.x = Math.max(-bound, Math.min(bound, pos.x)); pos.z = Math.max(-bound, Math.min(bound, pos.z)); return; }
  const dx = pos.x - c.site.x, dz = pos.z - c.site.z, d = Math.hypot(dx, dz), lim = c.R - 6;
  if (d > lim) { pos.x = c.site.x + (dx * lim) / d; pos.z = c.site.z + (dz * lim) / d; }
}

// A pose for board(): { x, y, z, yaw } in world coordinates, or undefined to use the usual beside-the-car spot.
export function mapAirPose(game, kind) {
  const L = layoutOf(game), m = game.arena && game.arena.map, car = game.player;
  if (!L || !L.air || !L.air.length || !m || !m.ctx || !car) return undefined;
  const s = m.ctx.site, want = kind === "jet" ? /^Runway/ : /^Helipad/;
  let best = null, bd = Infinity;
  for (const p of L.air) {
    if (!want.test(p.name)) continue;
    const d = (s.x + p.x - car.pos.x) ** 2 + (s.z + p.z - car.pos.z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return undefined;
  return { x: s.x + best.x, y: m.ctx.floorY + best.y + FLIGHT[kind].gear + 0.05, z: s.z + best.z, yaw: best.heading };
}
