// Damage on every piece: a crack overlay that darkens as HP drops, punched holes where heavy hits land,
// sparks on metal and smoke once a piece is badly hurt. Repair clears it all.
import * as THREE from "three";
import { crackMaterial } from "@/game/base/pieceLook";

const holeGeo = new THREE.CylinderGeometry(0.28, 0.22, 1, 8).rotateX(Math.PI / 2);
const holeMat = new THREE.MeshBasicMaterial({ color: "#0c0a08" });
const loc = new THREE.Vector3();

export function showHp(pc) {
  const k = pc.hp / pc.maxHp;
  if (k < 0.9 && !pc.crack) {
    pc.crack = new THREE.Mesh(pc.o.body.geometry, crackMaterial());
    pc.crack.scale.setScalar(1.015); pc.crack.renderOrder = 2;
    pc.o.root.add(pc.crack);
  }
  if (pc.crack) pc.crack.material.opacity = Math.min(0.95, (1 - k) * 1.25);
  // Badly hurt pieces sag a touch.
  pc.o.body.rotation.z = k < 0.35 ? (pc.sag ||= (Math.random() - 0.5) * 0.05) : 0;
}

export function punch(pc, point, size = 1) {
  if (!point || (pc.holes ||= []).length >= 4) return;
  pc.o.root.updateMatrixWorld();
  pc.o.root.worldToLocal(loc.copy(point));
  const [w, h, d] = pc.size;
  const m = new THREE.Mesh(holeGeo, holeMat);
  m.position.set(Math.max(-w / 2, Math.min(w / 2, loc.x)), Math.max(0.2, Math.min(h - 0.2, loc.y)), 0);
  m.scale.set(size, size, d + 0.04);
  pc.o.root.add(m);
  pc.holes.push(m);
}

export function clearDamage(pc) {
  if (pc.crack) { pc.crack.removeFromParent(); pc.crack.material.dispose(); pc.crack = null; }
  for (const m of pc.holes || []) m.removeFromParent();
  pc.holes = []; pc.o.body.rotation.z = 0; pc.sag = 0;
}

// Per frame for damaged pieces: smoke under 45 %, sparks on metal under 25 %.
export function tickDamage(game, pc, dt) {
  const k = pc.hp / pc.maxHp;
  if (k > 0.45) return;
  const x = pc.wx + (Math.random() - 0.5) * pc.fw, y = pc.top - 0.2, z = pc.wz + (Math.random() - 0.5) * pc.fd;
  if (Math.random() < dt * (k < 0.2 ? 4 : 1.5)) game.particles.smoke(x, y, z, k < 0.25, 1.1);
  if (k < 0.25 && (pc.mat === "sheet" || pc.mat === "steel") && Math.random() < dt * 2) game.particles.sparks(x, y, z, 3);
}

export function hitSparks(game, pc, point, kind) {
  const p = point || { x: pc.wx, y: pc.y0 + pc.size[1] / 2, z: pc.wz };
  if (pc.mat === "wood" || pc.mat === "concrete") game.particles.dust(p.x, p.y, p.z, 0, 0, kind === "mg" ? 0.5 : 1.4);
  if (pc.mat !== "wood" || kind !== "mg") game.particles.sparks(p.x, p.y, p.z, kind === "mg" ? 2 : 8);
}