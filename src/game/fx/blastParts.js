// Pooled explosion pieces that soft points can't draw: fireball cores, ground shock rings, spark streaks
// and tumbling debris chunks. Everything is created once; a burst only reuses free slots.
import * as THREE from "three";

const CORES = 12, RINGS = 10, STREAKS = 260, CHUNKS = 72;
const R = Math.random;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), d = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

// Hot white -> orange -> dark red, in HDR (values over 1) so the bloom catches the core.
function coreColor(c, k) {
  if (k < 0.35) { const t = k / 0.35; c.setRGB(9 - 5 * t, 7.5 - 5.3 * t, 5 - 4.4 * t); }
  else { const t = (k - 0.35) / 0.65; c.setRGB(4 - 3.5 * t, 2.2 - 2.1 * t, 0.6 - 0.58 * t); }
}

export function createBlastParts(scene, groundAt) {
  const coreGeo = new THREE.IcosahedronGeometry(1, 2);
  const cores = Array.from({ length: CORES }, () => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(coreGeo, mat);
    m.visible = false; m.renderOrder = 7; m.frustumCulled = false; scene.add(m);
    return { m, t: 0, max: 1, r: 1 };
  });
  const ringGeo = new THREE.RingGeometry(0.72, 1, 48).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, () => {
    const mat = new THREE.MeshBasicMaterial({ color: "#c9a77c", transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(ringGeo, mat);
    m.visible = false; m.renderOrder = 5; scene.add(m);
    return { m, t: 0, max: 1, r: 1 };
  });
  const streakMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), STREAKS);
  const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#2b2520", roughness: 0.9, metalness: 0.3 }), CHUNKS);
  for (const im of [streakMesh, chunkMesh]) {
    im.frustumCulled = false;
    for (let i = 0; i < im.count; i++) im.setMatrixAt(i, HIDE);
    scene.add(im);
  }
  chunkMesh.castShadow = true;
  const streaks = Array.from({ length: STREAKS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, w: 1 }));
  const chunks = Array.from({ length: CHUNKS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0, size: 0.3, g: 0 }));
  let ci = 0, ri = 0, si = 0, ki = 0;

  function burst(x, y, z, scale, budget) {
    const r = Math.sqrt(scale);
    const c = cores[ci]; ci = (ci + 1) % CORES;
    c.t = c.max = 0.18 + 0.22 * r; c.r = 1.6 * r + 0.4 * scale; c.m.position.set(x, y + 0.3 * r, z); c.m.visible = true;
    const gy = groundAt(x, z, y + 1);
    if (y - gy < 3 + 2 * r) {
      const g = rings[ri]; ri = (ri + 1) % RINGS;
      g.t = g.max = 0.5 + 0.25 * r; g.r = 5 + 5 * scale; g.m.position.set(x, gy + 0.2, z); g.m.visible = true;
    }
    const nS = Math.round((20 + 20 * Math.min(1, scale / 1.6)) * budget);
    for (let i = 0; i < nS; i++) {
      const k = streaks[si]; si = (si + 1) % STREAKS;
      const a = R() * 6.283, el = R() * 1.25 + 0.05, sp = (14 + R() * 18) * (0.6 + 0.4 * r);
      k.life = 0.35 + R() * 0.45; k.x = x; k.y = y + 0.3; k.z = z; k.w = 0.7 + R() * 0.8;
      k.vx = Math.cos(a) * Math.cos(el) * sp; k.vy = Math.sin(el) * sp; k.vz = Math.sin(a) * Math.cos(el) * sp;
    }
    const nC = Math.round((2 + 4 * Math.min(1.5, scale)) * budget + 0.5);
    for (let i = 0; i < nC; i++) {
      const k = chunks[ki]; ki = (ki + 1) % CHUNKS;
      const a = R() * 6.283, sp = (5 + R() * 8) * r;
      k.life = 2.5 + R() * 1.5; k.x = x; k.y = y + 0.5; k.z = z; k.size = (0.18 + R() * 0.32) * Math.min(1.8, r);
      k.vx = Math.cos(a) * sp; k.vy = 6 + R() * 8 * r; k.vz = Math.sin(a) * sp;
      k.sx = (R() - 0.5) * 14; k.sy = (R() - 0.5) * 14; k.sz = (R() - 0.5) * 14; k.g = gy;
    }
  }

  function update(dt) {
    for (const c of cores) {
      if (!c.m.visible) continue;
      c.t -= dt;
      if (c.t <= 0) { c.m.visible = false; continue; }
      const k = 1 - c.t / c.max;
      c.m.scale.setScalar(c.r * (0.35 + 0.65 * (1 - (1 - k) * (1 - k))));
      coreColor(c.m.material.color, k);
      c.m.material.opacity = 1 - k * k;
    }
    for (const g of rings) {
      if (!g.m.visible) continue;
      g.t -= dt;
      if (g.t <= 0) { g.m.visible = false; continue; }
      const k = 1 - g.t / g.max;
      g.m.scale.setScalar(g.r * (0.15 + 0.85 * (1 - (1 - k) ** 3)));
      g.m.material.opacity = 0.55 * (1 - k);
    }
    for (let i = 0; i < STREAKS; i++) {
      const k = streaks[i];
      if (k.life <= 0) continue;
      k.life -= dt;
      k.vy -= 14 * dt; k.vx *= 1 - 1.5 * dt; k.vz *= 1 - 1.5 * dt;
      k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
      d.set(k.vx, k.vy, k.vz);
      const sp = d.length();
      if (k.life <= 0 || sp < 0.5) { k.life = 0; streakMesh.setMatrixAt(i, HIDE); continue; }
      q.setFromUnitVectors(Z, d.divideScalar(sp));
      s.set(k.w, k.w, Math.min(2.4, sp * 0.05) * Math.min(1, k.life * 4));
      streakMesh.setMatrixAt(i, m4.compose(p.set(k.x, k.y, k.z), q, s));
    }
    for (let i = 0; i < CHUNKS; i++) {
      const k = chunks[i];
      if (k.life <= 0) continue;
      k.life -= dt;
      if (k.life <= 0) { chunkMesh.setMatrixAt(i, HIDE); continue; }
      k.vy -= 18 * dt;
      k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
      k.rx += k.sx * dt; k.ry += k.sy * dt; k.rz += k.sz * dt;
      if (k.vy < 0 && k.y < k.g + k.size * 0.5 + 2) k.g = groundAt(k.x, k.z, k.y + 1);
      if (k.y < k.g + k.size * 0.5) {
        k.y = k.g + k.size * 0.5;
        k.vy = Math.abs(k.vy) > 2 ? -k.vy * 0.38 : 0;
        k.vx *= 0.6; k.vz *= 0.6; k.sx *= 0.6; k.sy *= 0.6; k.sz *= 0.6;
      }
      const sz = k.size * Math.min(1, k.life * 2);
      q.setFromEuler(e.set(k.rx, k.ry, k.rz));
      chunkMesh.setMatrixAt(i, m4.compose(p.set(k.x, k.y, k.z), q, s.set(sz, sz * 0.6, sz * 1.3)));
    }
    streakMesh.instanceMatrix.needsUpdate = true;
    chunkMesh.instanceMatrix.needsUpdate = true;
  }

  return { burst, update };
}