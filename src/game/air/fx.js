// Aircraft visuals per render frame: spinning rotors, the jet's exhaust glow, a ground shadow blob,
// rotor-wash / jet-blast dust near the ground, and smoke and fire on the way down.
import * as THREE from "three";

const blobGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const tmp = new THREE.Vector3();

export function createAirFx(game, v) {
  const mat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.4, depthWrite: false });
  const blob = new THREE.Mesh(blobGeo, mat);
  blob.renderOrder = 2;
  game.scene.add(blob);
  let dustT = 0;
  const am = v.airMesh, s = v.flight;

  function frame(dt, ctl) {
    const root = v.mesh.root;
    // Rotor: idles on the ground, full speed in the air; winds down once wrecked.
    if (am.rotor) {
      const want = !v.alive ? 4 : s.grounded && !ctl.up ? 14 : 34;
      am.spin += (want - am.spin) * Math.min(1, dt * 1.5);
      am.rotor.rotation.y += am.spin * dt;
      am.tailRotor.rotation.x += am.spin * 1.6 * dt;
    }
    if (am.glow) {
      const k = !v.alive ? 0 : ctl.up ? 1.6 : ctl.down ? 0.5 : s.grounded && s.speed < 3 ? 0.35 : 1;
      am.glow.scale.set(1, 1, k * (0.85 + Math.random() * 0.3));
      am.glow.visible = k > 0;
    }
    // Shadow blob on whatever is underneath.
    const gy = game.world.groundAt(root.position.x, root.position.z, root.position.y - 0.5);
    const alt = Math.max(0, root.position.y - gy);
    const size = (v.air === "jet" ? 4.5 : 3.2) * (1 - Math.min(0.6, alt / 250));
    blob.position.set(root.position.x, gy + 0.06, root.position.z);
    blob.scale.setScalar(size);
    mat.opacity = 0.42 * Math.max(0.08, 1 - alt / 160);
    // Dust from the rotor wash (heli) or the blast (jet) close to the ground.
    const reach = v.air === "jet" ? 8 : 16;
    dustT -= dt;
    if (alt < reach && dustT <= 0 && (v.air === "heli" ? am.spin > 20 : s.speed > 20)) {
      dustT = 0.05 + (alt / reach) * 0.12;
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      game.particles.dust(root.position.x + Math.cos(a) * r, gy + 0.3, root.position.z + Math.sin(a) * r, Math.cos(a) * 6, Math.sin(a) * 6, 1.6 * (1 - alt / reach) + 0.4);
    }
    // Shot down: trail smoke and fire from the engine.
    if (!v.alive || v.hull / v.maxHull < 0.3) {
      tmp.set(...am.exhaust).applyQuaternion(root.quaternion).add(root.position);
      if (Math.random() < 0.7) game.particles.smoke(tmp.x, tmp.y, tmp.z, true, 2.2);
      if (!v.alive || Math.random() < 0.3) game.particles.fire(tmp.x, tmp.y, tmp.z, 1.4);
    }
  }

  function wreckLook() {
    am.paintMat.color.set("#2e2620");
    if (am.glow) am.glow.visible = false;
  }

  function dispose() { blob.removeFromParent(); mat.dispose(); am.paintMat.dispose(); }
  return { frame, wreckLook, dispose };
}