// The pieces of a pen map in the world: one mesh and one collider per solid or ramp, all removable, so the same
// pen can be rebuilt for another map (or for the same map after an edit). Markers and props are not built here.
import * as THREE from "three";
import { rampGeometry } from "@/game/arena/shapes";
import { KINDS } from "@/game/arena/custom/kinds";

export function createField(game) {
  const box = new THREE.BoxGeometry(1, 1, 1), disc = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const group = new THREE.Group(), glow = new Map();
  let ids = [];
  game.scene.add(group);

  const glowMat = (c) => {
    if (!glow.has(c)) glow.set(c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.4 }));
    return glow.get(c);
  };

  function clear() {
    for (const id of ids) game.world.colliders.removeById(id);
    ids = [];
    group.clear();
  }

  function set(ctx, map) {
    clear();
    const { site, floorY } = ctx, C = game.world.colliders, M = game.M;
    if (map.floor) { // a painted floor over the pen's concrete
      const f = new THREE.Mesh(disc, M.paint(map.floor));
      f.scale.setScalar(ctx.R - 0.2); f.position.set(site.x, floorY + 0.04, site.z); f.receiveShadow = true;
      group.add(f);
    }
    for (const p of map.pieces) {
      const K = KINDS[p.k], isRamp = K.group === "ramp";
      if (K.group !== "solid" && !isRamp) continue;
      const x = site.x + p.x, z = site.z + p.z, y = floorY + K.h / 2, yaw = (p.r * Math.PI) / 4, color = p.c || K.color;
      const m = new THREE.Mesh(isRamp ? rampGeometry(1) : box, K.glow ? glowMat(color) : M.paint(color));
      m.scale.set(K.w, K.h, K.d); m.position.set(x, y, z); m.rotation.y = yaw;
      m.castShadow = !K.glow; m.receiveShadow = true;
      group.add(m);
      const shape = isRamp ? { kind: "wedge", curve: 1, tag: "ramp" } : { tag: "arena" };
      ids.push(C.add({ x, y, z, hx: K.w / 2, hy: K.h / 2, hz: K.d / 2, yaw, ...shape }).id);
    }
  }

  return { set, clear, count: () => ids.length };
}