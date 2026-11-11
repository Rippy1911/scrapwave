// Near ground cover (lane A look pass): dry grass tufts that sway in the shared wind and loose pebbles, generated
// per 16 m cell around the camera from a hash of the cell (same tufts every time you come back), thinned with
// distance and with the preset (LOOK.cover / coverR). Render only: nothing here collides, and nothing grows on a road,
// a ramp lane, a bridge, a plot, an arena or a place core (world/keepout.js mask). Grass clusters where the terrain
// shader draws its withered-grass layer (same noise), so the tufts and the ground agree.
import * as THREE from "three";
import { onFrame, onQuality } from "@/game/render/frame";
import { lookFor } from "@/game/render/lookQuality";
import { addSway } from "@/game/render/foliage";
import { rockMaterial } from "@/game/render/rockMaterial";
import { loadModel, mergeParts, simplifyGeometry } from "@/game/assets/assets";
import { mulberry32, smoothstep } from "@/game/core/rng";
import { HARD } from "@/game/world/keepout";

const CELL = 16;

function tuftGeometry(seed = 7) {
  const r = mulberry32(seed), pos = [], col = [], nor = [];
  const base = new THREE.Color("#4a3a26"), mid = new THREE.Color("#8a7650"), tip = new THREE.Color("#cdb98a");
  const blades = 14;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.45, h = 0.32 + r() * 0.42, w = 0.022 + r() * 0.02;
    const ox = Math.cos(a) * r() * 0.12, oz = Math.sin(a) * r() * 0.12;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w;
    const P = (t, side) => [ox + dx * lean * h * t * t + px * side * (1 - t), h * t, oz + dz * lean * h * t * t + pz * side * (1 - t)];
    const v = [P(0, -1), P(0, 1), P(0.55, -1), P(0.55, 1), P(1, 0)];
    const tri = [[0, 1, 2], [1, 3, 2], [2, 3, 4]];
    const hue = 0.85 + r() * 0.3;
    const cs = [base, base, mid, mid, tip].map((c) => c.clone().multiplyScalar(hue));
    for (const t of tri) for (const i of t) { pos.push(...v[i]); col.push(cs[i].r, cs[i].g, cs[i].b); nor.push(dx * 0.25, 1, dz * 0.25); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.normalizeNormals();
  return g;
}

// CPU sampler of the shared value-noise canvas (render/textures.js noiseTex), wrapping, bilinear.
function noiseSampler(tex) {
  const img = tex && tex.image;
  if (!img || !img.getContext) return () => [0.5, 0.5, 0.5];
  const S = img.width, d = img.getContext("2d").getImageData(0, 0, S, S).data;
  return (u, v, ch) => {
    const x = (((u * S) % S) + S) % S, y = (((v * S) % S) + S) % S, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const at = (a, b) => d[(((b % S) * S) + (a % S)) * 4 + ch] / 255;
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
  };
}

export function createGroundCover(scene, terrain, keep, T) {
  const noise = noiseSampler(T.noise);
  const grassAt = (x, z) => smoothstep(0.5, 0.64, noise(x * 0.0085 + 0.31, z * 0.0085 + 0.31, 1) * 0.62 + noise(x * 0.045 + 0.57, z * 0.045 + 0.57, 2) * 0.38);
  const nrm = new THREE.Vector3();
  const { N, cell, half } = terrain;

  // grass
  const gMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
  addSway(gMat, 0.12, 0.6);
  const prevG = gMat.onBeforeCompile;
  gMat.onBeforeCompile = (sh, r) => { prevG(sh, r); sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal); // lit like the ground on both faces"); };
  const CAP_G = 26000, CAP_P = 9000;
  const grass = new THREE.InstancedMesh(tuftGeometry(), gMat, CAP_G);
  grass.count = 0; grass.frustumCulled = false; grass.castShadow = false; grass.receiveShadow = true;
  grass.name = "groundcover-grass";
  scene.add(grass);
  // pebbles: two small stone models under the shared rock material
  const pebbles = [];
  for (const name of ["rk_stones_0", "rk_stones_2", "rk_scree_1"]) {
    loadModel(name).then((raw) => {
      if (!raw) return;
      const part = mergeParts(raw)[0];
      const m = new THREE.InstancedMesh(simplifyGeometry(part.geometry, 0.16), rockMaterial(T), CAP_P); // a few dozen triangles: they are 10-40 cm
      m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.name = "groundcover-pebbles";
      scene.add(m);
      pebbles.push(m);
      dirty = true;
    });
  }

  const cache = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  function gen(ci, cj) {
    const key = ci * 4096 + cj;
    let c = cache.get(key);
    if (c) return c;
    const r = mulberry32((ci * 73856093) ^ (cj * 19349663) ^ 0x5bd1e995);
    const gm = [], pm = [[], [], []];
    const x0 = ci * CELL, z0 = cj * CELL;
    for (let t = 0; t < 240; t++) {
      const x = x0 + r() * CELL, z = z0 + r() * CELL, u = r(), roll = r(), yaw = r() * 6.28, sz = r();
      const kk = keep.at(x, z);
      if (kk === HARD) continue;
      const i = Math.round((x + half) / cell), j = Math.round((z + half) / cell);
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const k = j * N + i;
      if (terrain.cliffW[k] > 0.5) continue;
      terrain.normalAt(x, z, nrm);
      if (nrm.y < 0.82) continue;
      const salt = terrain.saltW[k], scree = terrain.screeW[k];
      const y = terrain.heightAt(x, z);
      // grass: dense in the patches, a few tufts everywhere but the salt
      const gs = (grassAt(x, z) * 0.9 + 0.08) * (1 - salt * 0.92) * (kk ? 0.5 : 1) * (1 - scree * 0.6);
      if (roll < gs) {
        const k2 = 0.7 + sz * 0.9;
        e.set((r() - 0.5) * 0.25, yaw, (r() - 0.5) * 0.25); q.setFromEuler(e);
        m4.compose(p.set(x, y - 0.04, z), q, s.set(k2, k2 * (0.8 + r() * 0.5), k2));
        gm.push(u, ...m4.elements);
      } else if (roll < gs + 0.08 + scree * 0.35 + salt * 0.04) {
        const k2 = 0.07 + Math.pow(sz, 2) * 0.32 * (1 + scree);
        e.set(r() * 3, yaw, r() * 3); q.setFromEuler(e);
        m4.compose(p.set(x, y - k2 * 0.25, z), q, s.set(k2, k2 * (0.6 + r() * 0.5), k2));
        pm[Math.floor(r() * 3)].push(u, ...m4.elements);
      }
    }
    c = { g: new Float32Array(gm), p: pm.map((a) => new Float32Array(a)) };
    cache.set(key, c);
    if (cache.size > 900) cache.delete(cache.keys().next().value);
    return c;
  }

  let L = lookFor(), dirty = true, lastCi = 1e9, lastCj = 1e9;
  function fill(cx, cz) {
    const R = L.coverR, dens = L.cover;
    let ng = 0;
    const np = [0, 0, 0];
    if (R > 0 && dens > 0) {
      const c0 = Math.floor((cx - R) / CELL), c1 = Math.floor((cx + R) / CELL), d0 = Math.floor((cz - R) / CELL), d1 = Math.floor((cz + R) / CELL);
      const G = grass.instanceMatrix.array;
      for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
        const ddx = Math.max(0, Math.abs(cx - (ci + 0.5) * CELL) - CELL / 2), ddz = Math.max(0, Math.abs(cz - (cj + 0.5) * CELL) - CELL / 2);
        if (ddx * ddx + ddz * ddz > R * R) continue;
        const c = gen(ci, cj);
        for (let o = 0; o < c.g.length && ng < CAP_G; o += 17) {
          const dx = c.g[o + 13] - cx, dz = c.g[o + 15] - cz, d = Math.sqrt(dx * dx + dz * dz);
          if (c.g[o] > dens * (1 - smoothstep(R * 0.35, R, d))) continue;
          G.set(c.g.subarray(o + 1, o + 17), ng * 16); ng++;
        }
        for (let v = 0; v < 3; v++) {
          const m = pebbles[v];
          if (!m) continue;
          const A = m.instanceMatrix.array, src = c.p[v];
          for (let o = 0; o < src.length && np[v] < CAP_P; o += 17) {
            const dx = src[o + 13] - cx, dz = src[o + 15] - cz, d = Math.sqrt(dx * dx + dz * dz);
            if (src[o] > Math.min(1, dens * 1.2) * (1 - smoothstep(R * 0.25, R * 0.7, d))) continue;
            A.set(src.subarray(o + 1, o + 17), np[v] * 16); np[v]++;
          }
        }
      }
    }
    grass.count = ng; grass.instanceMatrix.needsUpdate = true;
    pebbles.forEach((m, v) => { m.count = np[v]; m.instanceMatrix.needsUpdate = true; });
    return ng;
  }

  const api = { grass, pebbles, count: 0 };
  const offQ = onQuality(() => { L = lookFor(); dirty = true; });
  const offF = onFrame((cam) => {
    if (!cam) return;
    const ci = Math.floor(cam.position.x / (CELL / 2)), cj = Math.floor(cam.position.z / (CELL / 2));
    if (!dirty && ci === lastCi && cj === lastCj) return;
    dirty = false; lastCi = ci; lastCj = cj;
    api.count = fill(cam.position.x, cam.position.z);
  }, scene);
  api.dispose = () => { offQ(); offF(); };
  return api;
}
