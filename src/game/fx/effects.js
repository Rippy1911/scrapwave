// Tracers, flash lights, scrap pickups and flying debris (detached parts).
import * as THREE from "three";
import { DAMAGE } from "@/game/data/tuning";

export function createEffects(scene, M, world) {
  // Tracers: stretched instanced boxes
  const TMAX = 160;
  const tracerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1), M.tracer, TMAX);
  tracerMesh.frustumCulled = false;
  scene.add(tracerMesh);
  const tracers = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3();

  // Flash lights pool
  const lights = [0, 1, 2].map(() => { const l = new THREE.PointLight("#ffa040", 0, 40, 1.5); scene.add(l); return { l, t: 0, max: 1, i: 0 }; });
  let li = 0;

  // Debris
  const debris = [];

  return {
    tracer(a, b, speed = 600) {
      if (tracers.length >= TMAX) tracers.shift();
      const len = a.distanceTo(b);
      tracers.push({ a: a.clone(), dir: d.subVectors(b, a).normalize().clone(), len, t: 0, speed });
    },
    flash(x, y, z, intensity = 400, time = 0.25) {
      const L = lights[li]; li = (li + 1) % lights.length;
      L.l.position.set(x, y, z); L.t = time; L.max = time; L.i = intensity;
    },
    detach(v, part, impulseDir) {
      const obj = part.obj;
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
      obj.getWorldPosition(wp); obj.getWorldQuaternion(wq);
      obj.removeFromParent();
      obj.position.copy(wp); obj.quaternion.copy(wq);
      scene.add(obj);
      const sp = 4 + Math.random() * 5;
      debris.push({
        obj, life: DAMAGE.partLife,
        vel: v.vel.clone().multiplyScalar(0.8).add(new THREE.Vector3((impulseDir?.x || 0) * sp + (Math.random() - 0.5) * 4, 4 + Math.random() * 4, (impulseDir?.z || 0) * sp + (Math.random() - 0.5) * 4)),
        spin: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
        r: part.kind === "wheel" ? part.half.y : 0.3, wheel: part.kind === "wheel",
      });
    },
    update(dt, cam) {
      // tracers
      let n = 0;
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.t += dt * t.speed;
        if (t.t > t.len + 6) { tracers.splice(i, 1); continue; }
        const head = Math.min(t.t, t.len), tail = Math.max(0, t.t - 6);
        const l = head - tail;
        if (l <= 0) continue;
        p.copy(t.a).addScaledVector(t.dir, (head + tail) / 2);
        q.setFromUnitVectors(Z, t.dir);
        m4.compose(p, q, s.set(1, 1, l));
        tracerMesh.setMatrixAt(n++, m4);
      }
      tracerMesh.count = n;
      tracerMesh.instanceMatrix.needsUpdate = true;
      for (const L of lights) {
        if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.t / L.max) * L.i; } else L.l.intensity = 0;
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const b = debris[i];
        b.life -= dt;
        if (b.life <= 0 || b.obj.position.distanceToSquared(cam) > 400 * 400) { b.obj.removeFromParent(); debris.splice(i, 1); continue; }
        b.vel.y -= 15 * dt;
        b.obj.position.addScaledVector(b.vel, dt);
        const g = world.groundAt(b.obj.position.x, b.obj.position.z, b.obj.position.y + 1);
        if (b.obj.position.y - b.r < g) {
          b.obj.position.y = g + b.r;
          if (b.vel.y < 0) b.vel.y *= -0.35;
          b.vel.x *= b.wheel ? 0.995 : 0.9; b.vel.z *= b.wheel ? 0.995 : 0.9;
          b.spin.multiplyScalar(b.wheel ? 0.99 : 0.85);
        }
        b.obj.rotation.x += b.spin.x * dt; b.obj.rotation.y += b.spin.y * dt; b.obj.rotation.z += b.spin.z * dt;
        if (b.life < 2) b.obj.scale.setScalar(Math.max(0.01, b.life / 2));
      }
    },
  };
}

// Glowing scrap crates dropped by wrecks and loot piles.
export function createPickups(scene, M) {
  const geo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
  const glowMat = new THREE.MeshBasicMaterial({ color: "#f2c230", toneMapped: false, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowGeo = new THREE.CylinderGeometry(0.6, 0.9, 3, 10, 1, true);
  const list = [];
  return {
    list,
    spawn(x, y, z, amount, vx = 0, vz = 0) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(geo, M.rust); box.castShadow = true;
      const glow = new THREE.Mesh(glowGeo, glowMat); glow.position.y = 1.2;
      g.add(box, glow);
      g.position.set(x, y + 1, z);
      scene.add(g);
      list.push({ g, amount, vy: 5, vx, vz, life: 90, t: Math.random() * 6 });
    },
    update(dt, world) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt; p.t += dt;
        if (p.life <= 0) { p.g.removeFromParent(); list.splice(i, 1); continue; }
        p.vy -= 15 * dt;
        p.g.position.x += p.vx * dt; p.g.position.z += p.vz * dt; p.g.position.y += p.vy * dt;
        const gy = world.groundAt(p.g.position.x, p.g.position.z, p.g.position.y + 1) + 0.4;
        if (p.g.position.y < gy) { p.g.position.y = gy; p.vy = 0; p.vx *= 0.9; p.vz *= 0.9; }
        p.g.children[0].rotation.y = p.t * 1.5;
        p.g.children[1].scale.y = 0.8 + Math.sin(p.t * 4) * 0.2;
      }
    },
    take(p) { p.g.removeFromParent(); list.splice(list.indexOf(p), 1); },
  };
}