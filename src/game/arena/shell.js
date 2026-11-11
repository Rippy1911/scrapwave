// Arena shell on open ground: a level floor slab (its top just above the highest terrain under it), a closed
// ring wall with a hazard band, and an invisible containment wall above it so nobody jumps out mid-match.
// Returns the build context the arena layouts use (all positions are local to the arena centre, y from the floor).
import { createKit } from "@/game/world/places/kit";
import { rampGeometry } from "@/game/arena/shapes";

export function buildShell(game, site, look) {
  const { scene, M, world } = game, T = world.terrain, R = site.R;
  const kit = createKit(scene, M, world.colliders, T);
  let lo = Infinity, hi = -Infinity;
  for (let x = -R - 8; x <= R + 8; x += 4) for (let z = -R - 8; z <= R + 8; z += 4) {
    const h = T.heightAt(site.x + x, site.z + z);
    if (x * x + z * z <= (R + 3) ** 2) hi = Math.max(hi, h);
    lo = Math.min(lo, h);
  }
  const floorY = hi + 0.35;
  const F = kit.frame(site.x, floorY, site.z, 0);
  const th = floorY - lo + 2, size = 2 * R + 14;
  F.box(look.floor, 0, -th / 2, 0, size, th, size, 0, { collide: true, tag: "arenaFloor" });

  const N = 32, wallH = 7;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, w = (2 * Math.PI * (R + 0.8)) / N + 0.4;
    const lx = Math.sin(a) * (R + 0.8), lz = Math.cos(a) * (R + 0.8);
    F.box(look.wall, lx, wallH / 2, lz, w, wallH, 1.6, a, { collide: true, tag: "arenaWall" });
    F.box(M.hazard, Math.sin(a) * R, wallH - 0.6, Math.cos(a) * R, w, 0.8, 0.12, a);
    F.collider(lx, wallH + 25, lz, w, 50, 1.6, a, { noRay: true, tag: "arenaFence" });
  }

  const ctx = {
    kit, F, M, R, floorY, site, look,
    solid(mat, lx, ly, lz, w, h, d, ry = 0, tag = "arena") { return F.box(mat, lx, ly + h / 2, lz, w, h, d, ry, { collide: true, tag }); },
    deco(mat, lx, ly, lz, w, h, d, ry = 0, o = {}) { F.box(mat, lx, ly + h / 2, lz, w, h, d, ry, o); },
    // A ramp whose foot sits at local height ly; rises toward local -z (turn it with ry).
    ramp(lx, lz, w, len, h, ry = 0, o = {}) {
      F.prim(rampGeometry(o.curve || 1), o.mat || look.ramp, lx, (o.ly || 0) + h / 2, lz, w, h, len, 0, ry);
      return F.wedge(lx, lz, w, len, h, ry, { baseY: floorY + (o.ly || 0), curve: o.curve || 1 });
    },
    // Position helpers: polar to local, outward-facing yaw at an angle.
    polar: (a, r) => [Math.sin(a) * r, Math.cos(a) * r],
    world: (lx, lz) => ({ x: site.x + lx, z: site.z + lz }),
  };
  return ctx;
}

// Turn a layout's local points into world points on the floor.
export function toWorldPoints(ctx, list, extraY = 0) {
  return list.map((p) => ({ ...p, x: ctx.site.x + p.x, z: ctx.site.z + p.z, y: ctx.floorY + (p.y || 0) + extraY }));
}