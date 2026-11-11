// Brasswater's ambient crowds, all cosmetic: zombies shuffling up and down the streets in packs (a ram at speed
// flattens them, and a new pack forms somewhere else a while later), and grey aliens that come out on the tall roofs
// at night and fade back in the morning. Never people. Two instanced meshes, matrices rewritten each frame for the
// ones near the camera only. The real horde (hunt mode) is arena/horde.js and is separate from these.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CITY, ZONES, hw } from "@/game/maps/city/plan";
import { compose } from "@/game/maps/city/chunks";
import { RC } from "@/game/render/frame";

const Z_COUNT = 260, A_COUNT = 56, NEAR = 170, FAR_STEP = 6;
const col = (c) => new THREE.Color(c);

// A box of the given size at (x, y, z), painted one colour (vertex colours, so one material draws the whole body).
function part(w, h, d, x, y, z, c) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  const k = col(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  g.deleteAttribute("uv");
  return g;
}
const zombieGeo = () => mergeGeometries([
  part(0.5, 0.72, 0.28, 0, 1.18, 0, "#6b5a46"), part(0.3, 0.3, 0.3, 0, 1.72, -0.03, "#7f9570"), part(0.2, 0.8, 0.22, -0.14, 0.4, 0, "#3b3a3d"), part(0.2, 0.8, 0.22, 0.14, 0.4, 0.04, "#3b3a3d"),
  part(0.13, 0.13, 0.72, -0.36, 1.36, -0.42, "#7f9570"), part(0.13, 0.13, 0.62, 0.36, 1.32, -0.38, "#7f9570"),
]);
const alienGeo = () => mergeGeometries([
  part(0.28, 0.82, 0.2, 0, 1.0, 0, "#9ea3a6"), part(0.46, 0.5, 0.4, 0, 1.68, 0, "#aab0b2"), part(0.12, 0.16, 0.05, -0.12, 1.68, -0.2, "#0b0c0e"), part(0.12, 0.16, 0.05, 0.12, 1.68, -0.2, "#0b0c0e"),
  part(0.1, 0.72, 0.1, -0.24, 0.9, 0, "#8d9396"), part(0.1, 0.72, 0.1, 0.24, 0.9, 0, "#8d9396"), part(0.12, 0.6, 0.12, -0.08, 0.3, 0, "#8d9396"), part(0.12, 0.6, 0.12, 0.08, 0.3, 0, "#8d9396"),
]);

export function createCrowds(game, group, site, plan, rng) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const zMesh = new THREE.InstancedMesh(zombieGeo(), mat, Z_COUNT), aMesh = new THREE.InstancedMesh(alienGeo(), mat, A_COUNT);
  for (const m of [zMesh, aMesh]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; group.add(m); }
  const tint = new THREE.Color(), m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // ---- zombies: each walks a stretch of one street (axis 0: along x at z = line; axis 1: along z at x = line)
  const bad = (x, z) => Math.abs(x) < 112 && Math.abs(z) < 112 || x > ZONES.airfield.x0 - 10 && x < ZONES.airfield.x1 + 10 && z > ZONES.airfield.z0 - 10 && z < ZONES.airfield.z1 + 10
    || x > ZONES.harbour.x0 - 8 && x < ZONES.harbour.x1 + 8 && z > ZONES.harbour.z0 - 8 || Math.hypot(x - ZONES.stadium.cx, z - ZONES.stadium.cz) < ZONES.stadium.r + 14 || Math.hypot(x, z) > CITY.INNER - 6;
  const Z = [];
  const packAt = (out, n) => {
    for (let tries = 0; tries < 40; tries++) {
      const axis = rng() < 0.5 ? 0 : 1, k = Math.floor(rng() * 11) - 5, line = k * CITY.G, t0 = (rng() * 2 - 1) * 560, span = 30 + rng() * 40;
      const x = axis ? line : t0, z = axis ? t0 : line;
      if (bad(x, z) || bad(axis ? x : x + span, axis ? z + span : z) || bad(axis ? x : x - span, axis ? z - span : z)) continue;
      for (let i = 0; i < n; i++) {
        const side = (rng() * 2 - 1) * (hw(k) - 1.5), along = t0 + (rng() * 2 - 1) * 8;
        out.push({ axis, line: line + side, t: along, lo: t0 - span, hi: t0 + span, dir: rng() < 0.5 ? -1 : 1, v: 0.5 + rng() * 0.7, ph: rng() * 6.28, hit: -1, alive: true });
      }
      return true;
    }
    return false;
  };
  while (Z.length < Z_COUNT) { if (!packAt(Z, 3 + Math.floor(rng() * 4))) break; }
  Z.length = Math.min(Z.length, Z_COUNT);
  Z.forEach((z, i) => { tint.setHSL(0.18 + rng() * 0.06, 0.1, 0.78 + rng() * 0.4); zMesh.setColorAt(i, tint); });
  zMesh.count = Z.length;
  // ---- aliens: on the roofs of tall blocks, a few to a roof, facing the street
  const A = [];
  const spots = plan.roofSpots.filter((s) => s.y > 28).sort(() => rng() - 0.5);
  for (const s of spots) {
    for (let i = 0; i < 1 + Math.floor(rng() * 2) && A.length < A_COUNT; i++) A.push({ x: s.x + (rng() * 2 - 1) * Math.max(0, s.hw - 3), z: s.z + (rng() * 2 - 1) * Math.max(0, s.hd - 3), y: s.y + 0.05, yaw: rng() * 6.28, ph: rng() * 6.28 });
    if (A.length >= A_COUNT) break;
  }
  A.forEach((a, i) => { tint.setHSL(0.5, 0.04, 0.8 + rng() * 0.3); aMesh.setColorAt(i, tint); });
  aMesh.count = A.length;

  let night = 0, nightT = 0, frameN = 0, t = 0, killed = 0;
  const reach2 = (r) => r * r;
  const kill = (z, v) => {
    z.alive = false; z.hit = 0; killed++;
    const wx = site.x + (z.axis ? z.line : z.t), wz = site.z + (z.axis ? z.t : z.line);
    game.particles.dust(wx, site.y + 1, wz, v ? v.vel.x * 0.1 : 0, v ? v.vel.z * 0.1 : 0, 1.4);
    game.particles.sparks(wx, site.y + 1, wz, 4);
    const p = new THREE.Vector3(wx, site.y + 1, wz);
    if (game.audio) game.audio.impact(p, 0.45);
  };
  const place = (i, z) => {
    const wob = Math.sin(t * 3.2 * z.v + z.ph);
    const x = z.axis ? z.line : z.t, zz = z.axis ? z.t : z.line, yaw = Math.atan2(-(z.axis ? 0 : z.dir), -(z.axis ? z.dir : 0)) + wob * 0.1;
    if (z.alive) compose(x, 0.04 + Math.abs(wob) * 0.04, zz, yaw, 1, 1, 1, m4);
    else { const f = Math.min(1, z.hit / 0.35); compose(x, 0.04 + 0.1 * f, zz, yaw, 1, Math.max(0.05, 1 - f), 1 + f * 0.3, m4); }
    zMesh.setMatrixAt(i, m4);
  };

  function step(dt) {
    t += dt;
    nightT -= dt;
    if (nightT <= 0) { nightT = 0.5; const s = game.skyCycle && game.skyCycle.state(); night = s ? s.night : 0; }
    const cam = RC.camera, cx = (cam ? cam.position.x : site.x) - site.x, cz = (cam ? cam.position.z : site.z) - site.z;
    frameN++;
    const hot = []; // moving vehicles in plan coordinates, for the rams
    for (const v of game.vehicles) if (v.alive && !v.remote && v.vel.lengthSq() > 16) hot.push(v);
    for (let i = 0; i < Z.length; i++) {
      const z = Z[i], x = z.axis ? z.line : z.t, zz = z.axis ? z.t : z.line, near = (x - cx) ** 2 + (zz - cz) ** 2 < NEAR * NEAR;
      if (!z.alive) { z.hit += dt; if (z.hit > 0.35 && z.hit < 26) { if (near && frameN % FAR_STEP === 0) place(i, z); continue; } if (z.hit >= 26) revive(z, cx, cz); place(i, z); continue; }
      if (!near && frameN % FAR_STEP !== i % FAR_STEP) continue;
      const stepDt = near ? dt : dt * FAR_STEP;
      z.t += z.dir * z.v * stepDt;
      if (z.t < z.lo) { z.t = z.lo; z.dir = 1; } else if (z.t > z.hi) { z.t = z.hi; z.dir = -1; }
      for (const v of hot) {
        const dx = x + site.x - v.pos.x, dz = zz + site.z - v.pos.z, r = v.chassis.hit.half[0] + 0.8;
        if (dx * dx + dz * dz < reach2(r) && Math.abs(site.y - v.pos.y) < 12) { kill(z, v); break; }
      }
      place(i, z);
    }
    zMesh.instanceMatrix.needsUpdate = true;
    // aliens: up at night, gone by day; they bob and turn on the spot, and hop when a car is close
    const up = THREE.MathUtils.smoothstep(night, 0.3, 0.55);
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (up < 0.02) { aMesh.setMatrixAt(i, zero); continue; }
      const near = (a.x - cx) ** 2 + (a.z - cz) ** 2 < 70 * 70, hop = near ? Math.max(0, Math.sin(t * 5 + a.ph)) * 0.5 : 0;
      compose(a.x, a.y + hop, a.z, a.yaw + Math.sin(t * 0.7 + a.ph) * 0.8, up, up, up, m4);
      aMesh.setMatrixAt(i, m4);
    }
    aMesh.instanceMatrix.needsUpdate = true;
  }
  function revive(z, cx, cz) {
    const tmp = [];
    for (let k = 0; k < 8; k++) {
      tmp.length = 0;
      if (!packAt(tmp, 1)) return;
      const n = tmp[0], x = n.axis ? n.line : n.t, zz = n.axis ? n.t : n.line;
      if ((x - cx) ** 2 + (zz - cz) ** 2 < 90 * 90) continue;
      Object.assign(z, n, { alive: true, hit: -1 });
      return;
    }
    z.hit = 20; // nowhere good yet: try again in a few seconds
  }
  step(0);
  return {
    step,
    count: () => ({ zombies: Z.length, zombiesAlive: Z.filter((z) => z.alive).length, rammed: killed, aliens: A.length, night: +night.toFixed(2) }),
    dispose() { for (const m of [zMesh, aMesh]) { group.remove(m); m.geometry.dispose(); m.dispose(); } mat.dispose(); },
  };
}
