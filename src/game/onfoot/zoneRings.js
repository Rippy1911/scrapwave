// Faint green rings on the ground marking every safe zone: a thin ribbon that follows the terrain and road surface.
// Rebuilt when the zone list changes (claiming or losing a plot, a raid starting); hidden in arenas.
import * as THREE from "three";
import { surfaceY } from "@/game/world/spawn";

const SEGS = 160, WIDTH = 0.7, LIFT = 0.14;

function ringGeometry(world, zone) {
  const pos = new Float32Array((SEGS + 1) * 2 * 3), idx = [];
  for (let i = 0; i <= SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    for (let k = 0; k < 2; k++) {
      const r = zone.r - k * WIDTH, x = zone.x + c * r, z = zone.z + s * r;
      pos.set([x, surfaceY(world, x, z) + LIFT, z], (i * 2 + k) * 3);
    }
    if (i < SEGS) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createZoneRings(game, zones) {
  const group = new THREE.Group();
  group.name = "safe-zone-rings";
  game.scene.add(group);
  const mat = new THREE.MeshBasicMaterial({ color: "#7fe0a0", transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  let built = -1;

  function rebuild() {
    for (const m of group.children) m.geometry.dispose();
    group.clear();
    for (const z of zones.all()) {
      const m = new THREE.Mesh(ringGeometry(game.world, z), mat);
      m.renderOrder = 2; m.frustumCulled = false;
      group.add(m);
    }
    built = zones.version;
  }

  return {
    frame(time) {
      if (built !== zones.version) rebuild();
      group.visible = !(game.arena && game.arena.active);
      mat.opacity = 0.22 + Math.sin(time * 1.6) * 0.05;
    },
    dispose() { for (const m of group.children) m.geometry.dispose(); group.clear(); group.removeFromParent(); mat.dispose(); },
  };
}