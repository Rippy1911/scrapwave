// Tumbleweeds: a pool of dry twig balls that roll and bounce with the wind around the camera. Cars smash them
// into a burst of twigs and a dust puff; slow cars just shove them. Cosmetic only: no colliders, no physics
// bodies. Two instanced meshes (twig cage + alpha-tested shell) share the matrices; one more for flying twigs.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WIND, windSpeedAt } from "@/game/render/wind";
import { mulberry32 } from "@/game/core/rng";

const MAXW = 44, MAXT = 180;

function cageGeometry() {
  const r = mulberry32(77), parts = [];
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Quaternion();
  const onSphere = (v, rad) => { const u = r() * 2 - 1, t = r() * 6.28, s = Math.sqrt(1 - u * u); return v.set(s * Math.cos(t), u, s * Math.sin(t)).multiplyScalar(rad); };
  for (let i = 0; i < 34; i++) {
    onSphere(a, 0.75 + r() * 0.3); onSphere(b, 0.6 + r() * 0.4);
    if (a.distanceTo(b) < 0.5) b.negate();
    d.subVectors(b, a); const len = d.length();
    const c = new THREE.CylinderGeometry(0.018, 0.026, len, 3, 1, true);
    q.setFromUnitVectors(up, d.normalize());
    c.applyQuaternion(q); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(c.toNonIndexed());
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

function twigTexture() {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const ctx = c.getContext("2d"), r = mulberry32(5);
  ctx.clearRect(0, 0, S, S);
  ctx.lineCap = "round";
  for (let i = 0; i < 150; i++) {
    let x = r() * S, y = r() * S, ang = r() * 6.28;
    ctx.strokeStyle = `rgb(${150 + r() * 50},${112 + r() * 40},${70 + r() * 30})`;
    ctx.lineWidth = 1 + r() * 2.2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { ang += (r() - 0.5) * 1.4; x += Math.cos(ang) * 14; y += Math.sin(ang) * 14; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** vehicles(): live vehicle list ({ pos, vel, alive }). dust: the dust system (puffs on impact). */
export function createTumbleweeds(scene, terrain, vehicles, dust) {
  const cage = new THREE.InstancedMesh(cageGeometry(), new THREE.MeshStandardMaterial({ color: "#9a7650", roughness: 1 }), MAXW);
  const tex = twigTexture();
  const shellMat = new THREE.MeshStandardMaterial({ map: tex, color: "#c9a678", roughness: 1, alphaTest: 0.4, side: THREE.DoubleSide });
  const shell = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.82, 1), shellMat, MAXW);
  shell.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.4, side: THREE.DoubleSide });
  for (const m of [cage, shell]) { m.frustumCulled = false; m.count = 0; m.castShadow = true; m.receiveShadow = false; scene.add(m); }
  cage.castShadow = false;
  const twigs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.42), cage.material, MAXT);
  twigs.frustumCulled = false; twigs.count = 0;
  scene.add(twigs);

  const W = [], T = [];
  for (let i = 0; i < MAXW; i++) W.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 0.5, q: new THREE.Quaternion(), wait: Math.random() * 2, grow: 0, k: 1, hop: 0 });
  for (let i = 0; i < MAXT; i++) T.push({ life: 1, max: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, q: new THREE.Quaternion(), wx: 0, wy: 0, wz: 0, s: 1 });
  let thead = 0, active = 30, R = 150, smashed = 0;
  const eu = new THREE.Euler();

  const camVel = new THREE.Vector3(), lastCam = new THREE.Vector3(1e9, 0, 0);
  function respawn(w, cam) {
    const cx = cam.position.x, cz = cam.position.z;
    const sp = Math.hypot(camVel.x, camVel.z);
    let ang;
    if (sp > 6 && Math.random() < 0.6) ang = Math.atan2(camVel.z, camVel.x) + (Math.random() - 0.5) * 1.6; // ahead of a moving camera
    else ang = Math.atan2(-WIND.z, -WIND.x) + (Math.random() - 0.5) * 2.6; // upwind, so it rolls across the view
    const d = R * (0.35 + Math.random() * 0.6);
    w.x = cx + Math.cos(ang) * d; w.z = cz + Math.sin(ang) * d;
    w.r = 0.38 + Math.random() * 0.4; w.k = 0.75 + Math.random() * 0.5;
    w.y = terrain.heightAt(w.x, w.z) + w.r + Math.random() * 0.6;
    const ws = windSpeedAt(w.x, w.z) * w.k;
    w.vx = WIND.x * ws; w.vz = WIND.z * ws; w.vy = 0; w.grow = 0; w.wait = 0;
    w.q.setFromEuler(eu.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  }
  function smash(w, v) {
    smashed++;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = T[thead]; thead = (thead + 1) % MAXT;
      const a = Math.random() * 6.28, up = Math.random();
      t.life = 0; t.max = 1.2 + Math.random() * 1.2;
      t.x = w.x + Math.cos(a) * w.r * 0.6; t.y = w.y + (up - 0.3) * w.r; t.z = w.z + Math.sin(a) * w.r * 0.6;
      const sp = 2.5 + Math.random() * 5;
      t.vx = Math.cos(a) * sp + v.vel.x * 0.55; t.vy = 2 + up * 5; t.vz = Math.sin(a) * sp + v.vel.z * 0.55;
      t.q.setFromEuler(eu.set(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      t.wx = (Math.random() - 0.5) * 18; t.wy = (Math.random() - 0.5) * 18; t.wz = (Math.random() - 0.5) * 18; t.s = 0.6 + Math.random() * 0.8;
    }
    if (dust) dust.puff(w.x, w.y, w.z, { size: 1.8, grow: 2.2, life: 1.6, alpha: 0.35, vx: v.vel.x * 0.3, vz: v.vel.z * 0.3 });
    w.y = -999; w.wait = 1.5 + Math.random() * 3;
  }

  const m4 = new THREE.Matrix4(), dq = new THREE.Quaternion(), ax = new THREE.Vector3(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  function update(cam, dt) {
    if (lastCam.x < 1e8 && dt > 0) camVel.lerp(p.subVectors(cam.position, lastCam).divideScalar(dt), Math.min(1, dt * 3));
    lastCam.copy(cam.position);
    const vs = vehicles ? vehicles() : [];
    let n = 0;
    for (let i = 0; i < active; i++) {
      const w = W[i];
      if (w.wait > 0) { w.wait -= dt; if (w.wait <= 0) respawn(w, cam); continue; }
      if ((w.x - cam.position.x) ** 2 + (w.z - cam.position.z) ** 2 > R * R * 1.1) { respawn(w, cam); continue; }
      const ws = windSpeedAt(w.x, w.z) * w.k;
      const k = Math.min(1, dt * 1.4);
      const gy = terrain.heightAt(w.x, w.z);
      const onGround = w.y - w.r <= gy + 0.05;
      w.vx += (WIND.x * ws - w.vx) * k * (onGround ? 1 : 0.3); w.vz += (WIND.z * ws - w.vz) * k * (onGround ? 1 : 0.3);
      w.vy -= 9.8 * dt;
      w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
      const g2 = terrain.heightAt(w.x, w.z);
      if (w.y - w.r < g2) {
        w.y = g2 + w.r;
        const hsp = Math.hypot(w.vx, w.vz);
        if (w.vy < -1.5) w.vy = -w.vy * 0.45; // bounce
        else if (Math.random() < dt * 0.9 * Math.min(2, hsp / 4)) w.vy = 1.5 + Math.random() * 2.5 * Math.min(1.5, hsp / 5); // hop over a bump
        else w.vy = Math.max(0, (g2 - gy) / Math.max(dt, 1e-3) * 0.6); // ride up slopes
      }
      // cars: smash when fast, shove when slow
      for (const v of vs) {
        if (!v.pos || v.alive === false) continue;
        const dx = w.x - v.pos.x, dz = w.z - v.pos.z, dy = w.y - v.pos.y;
        if (dx * dx + dz * dz > (w.r + 1.7) ** 2 || Math.abs(dy) > 2.5) continue;
        const sp = Math.hypot(v.vel.x, v.vel.z);
        if (sp > 6) { smash(w, v); break; }
        const d = Math.hypot(dx, dz) || 1;
        w.vx = (dx / d) * 3 + v.vel.x; w.vz = (dz / d) * 3 + v.vel.z; w.vy = Math.max(w.vy, 2.2);
      }
      if (w.y < -900) continue;
      // roll about the axis across the motion
      const hsp = Math.hypot(w.vx, w.vz);
      if (hsp > 0.05) { ax.set(w.vz / hsp, 0, -w.vx / hsp); dq.setFromAxisAngle(ax, (hsp / w.r) * dt); w.q.premultiply(dq); }
      w.grow = Math.min(1, w.grow + dt * 1.2);
      const s = w.r / 0.82 * (w.grow * w.grow * (3 - 2 * w.grow));
      m4.compose(p.set(w.x, w.y, w.z), w.q, sc.set(s, s * 0.92, s));
      cage.setMatrixAt(n, m4); shell.setMatrixAt(n, m4);
      n++;
    }
    cage.count = shell.count = n;
    cage.instanceMatrix.needsUpdate = shell.instanceMatrix.needsUpdate = true;
    // flying twigs
    let tn = 0;
    for (const t of T) {
      if (t.life >= t.max) continue;
      t.life += dt;
      t.vy -= 9.8 * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
      const gy = terrain.heightAt(t.x, t.z);
      if (t.y < gy + 0.03) { t.y = gy + 0.03; t.vx *= 0.5; t.vz *= 0.5; t.vy = Math.abs(t.vy) * 0.2; t.wx *= 0.4; t.wy *= 0.4; t.wz *= 0.4; }
      dq.setFromEuler(eu.set(t.wx * dt, t.wy * dt, t.wz * dt)); t.q.multiply(dq);
      const fade = Math.min(1, (t.max - t.life) * 3) * t.s;
      m4.compose(p.set(t.x, t.y, t.z), t.q, sc.set(fade, fade, fade));
      twigs.setMatrixAt(tn++, m4);
    }
    twigs.count = tn; twigs.instanceMatrix.needsUpdate = true;
    return n;
  }
  function setQuality(q) {
    const a = q.atmos ?? 1;
    active = Math.max(8, Math.min(MAXW, Math.round(30 * a)));
    R = a < 0.5 ? 110 : 150;
    shell.castShadow = !!q.shadows && a >= 0.7;
  }
  return { update, setQuality, counts: () => ({ tumbleweeds: cage.count, twigs: twigs.count, smashed }) };
}
