// Fortress sites: from a rough map spot, the flattest clear ground within 70 m that keeps away from plots,
// places and roads; the gate faces the nearest road.
import { PLACES } from "@/game/data/places";
import worldConfig from "@/game/net/world-config.json";

const R = 22;

export function findFortSite(game, s) {
  const { terrain, roads, colliders } = game.world;
  const plots = worldConfig.plots || [];
  let best = null;
  for (let ox = -70; ox <= 70; ox += 10) for (let oz = -70; oz <= 70; oz += 10) {
    const x = s.x + ox, z = s.z + oz;
    if (Math.abs(x) > 560 || Math.abs(z) > 560) continue;
    if (plots.some((p) => Math.hypot(p.x - x, p.z - z) < 90) || PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < (p.pad || p.r) + 40)) continue;
    let lo = Infinity, hi = -Infinity;
    for (let a = -R; a <= R; a += 11) for (let b = -R; b <= R; b += 11) { const h = terrain.heightAt(x + a, z + b); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const rd = roads.nearest(x, z, 12, false).dist;
    let props = 0;
    colliders.collect(x, z, R + 4, (b) => { if (!b.dead && !b.piece) props++; });
    const score = (hi - lo) * 3 + props * 4 + (rd < R + 6 ? 40 : 0) + Math.hypot(ox, oz) * 0.02;
    if (!best || score < best.score) best = { x, z, score };
  }
  best ||= { x: s.x, z: s.z };
  const n = roads.nearest(best.x, best.z, 12, false);
  const a = Number.isFinite(n.dist) ? Math.atan2(n.x - best.x, n.z - best.z) : 0;
  const q = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
  return { x: best.x, y: terrain.heightAt(best.x, best.z), z: best.z, q, gateA: (q * Math.PI) / 2 };
}