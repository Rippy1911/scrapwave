// Everything the on-foot fight draws: the weapon in the walker's hand, bullet streaks, rockets, grenades, C4
// charges and the loot bag a dead walker drops. onfoot/footShots.js and footCombat.js decide what flies where and
// hold no three.js of their own; v3() hands them vectors. Barrels point along -z, sights up.
import * as THREE from "three";

const STREAKS = 24, STREAK_LIFE = 0.12;

export function createFootFx(scene) {
  const steel = new THREE.MeshStandardMaterial({ color: "#3b3f44", roughness: 0.5, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a2c", roughness: 0.8 });
  const olive = new THREE.MeshStandardMaterial({ color: "#5e6b3a", roughness: 0.85 });
  const hot = new THREE.MeshBasicMaterial({ color: "#ffb347" });
  const red = new THREE.MeshBasicMaterial({ color: "#ff4a2a" });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const tube = (r, len, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8).rotateX(Math.PI / 2), mat); m.position.set(x, y, z); return m; };
  const group = (...parts) => { const g = new THREE.Group(); for (const p of parts) { p.castShadow = true; g.add(p); } return g; };
  const build = {
    sniper: () => group(box(0.06, 0.09, 0.5, wood, 0, 0, 0.1), tube(0.018, 0.8, steel, 0, 0.02, -0.5), tube(0.03, 0.26, steel, 0, 0.09, -0.05)),
    rpg: () => group(tube(0.05, 1, olive, 0, 0.02, -0.1), tube(0.08, 0.22, steel, 0, 0.02, -0.7), box(0.04, 0.12, 0.05, wood, 0, -0.07, 0)),
    sidearm: () => group(box(0.035, 0.05, 0.2, steel, 0, 0.02, -0.08), box(0.035, 0.11, 0.045, wood, 0, -0.05, 0)),
    grenade: () => group(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), olive)),
    c4: () => group(box(0.2, 0.07, 0.14, olive), box(0.03, 0.03, 0.03, red, 0, 0.05, 0)),
    rocket: () => group(tube(0.05, 0.5, steel), box(0.06, 0.06, 0.1, hot, 0, 0, 0.3)),
    bag: () => group(box(0.55, 0.3, 0.36, olive, 0, 0.15, 0), box(0.57, 0.06, 0.1, hot, 0, 0.2, 0)),
  };
  const free = (g) => { g.removeFromParent(); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };

  // The weapon in the hand: one model per id, made once, parented to the forearm with the barrel along it.
  const models = {};
  let held = null;
  function hold(joint, id) {
    const next = id && build[id] ? (models[id] || (models[id] = build[id]())) : null;
    if (next === held && (!next || next.parent === joint)) return;
    if (held) held.removeFromParent();
    held = next;
    if (!held) return;
    held.rotation.x = -Math.PI / 2;
    held.position.set(0, -0.3, -0.06);
    joint.add(held);
  }

  const streaks = Array.from({ length: STREAKS }, () => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#ffe9b0", transparent: true, opacity: 0, depthWrite: false }));
    l.visible = false; l.frustumCulled = false;
    scene.add(l);
    return { l, t: 0 };
  });
  let next = 0;

  return {
    v3: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    hold,
    // A bullet's path over one step, fading out.
    streak(a, b) {
      const s = streaks[next++ % STREAKS], p = s.l.geometry.attributes.position;
      p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
      s.t = STREAK_LIFE; s.l.visible = true;
    },
    // A thing in the world: "rocket" | "grenade" | "c4" | "bag". The caller moves it and removes it.
    spawn(kind, parent = scene) { const g = build[kind](); parent.add(g); return g; },
    remove: free,
    // Points the model's barrel (-z) along d.
    face(g, d) { g.lookAt(g.position.x - d.x, g.position.y - d.y, g.position.z - d.z); },
    update(dt) {
      for (const s of streaks) {
        if (s.t <= 0) continue;
        s.t -= dt;
        s.l.material.opacity = Math.max(0, s.t / STREAK_LIFE);
        if (s.t <= 0) s.l.visible = false;
      }
    },
    dispose() {
      for (const s of streaks) { s.l.removeFromParent(); s.l.geometry.dispose(); s.l.material.dispose(); }
      for (const id in models) free(models[id]);
      for (const m of [steel, wood, olive, hot, red]) m.dispose();
    },
  };
}