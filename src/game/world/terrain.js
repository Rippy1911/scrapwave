// 1,200 m heightfield: salt flats, mesas and buttes with strata cliffs and scree aprons (world/landform.js), dunes,
// the terraced canyon, flattened pads and roads. 512 cells a side (2.34 m): vehicles/rapier.js builds the physics
// heightfield from T.H, so cliffs, ledges and aprons are physical. Drawn as 8 x 8 chunks (frustum and shadow culled),
// shaded by render/terrainMaterial.js (PBR layers by height, slope, apron and noise; triplanar strata rock).
import * as THREE from "three";
import { WORLD } from "@/game/data/tuning";
import { CANYON } from "@/game/data/places";
import { makeNoise2D, fbm, smoothstep, distToPolyline, lerp, clamp } from "@/game/core/rng";
import { createTerrainMaterial, terrainShadowDepth } from "@/game/render/terrainMaterial";
import { signedDistance, tierHeight, canyonFill, pickButtes, rampZones, rampZoneWeight } from "@/game/world/landform";

export const SURF = { sand: 0, salt: 1, rock: 2, road: 3 };
const SEG = 512, CHUNKS = 8;

export function createTerrain(seed = WORLD.seed) {
  const N = SEG + 1, S = WORLD.size, half = S / 2, cell = S / SEG, NN = N * N;
  const H = new Float32Array(NN);
  const saltW = new Float32Array(NN);
  const mesaW = new Float32Array(NN);
  const screeW = new Float32Array(NN); // scree apron at the foot of cliffs and canyon walls (gravel + rubble)
  const cliffW = new Float32Array(NN); // strata cliff bands (rock, cliff dressing)
  const surf = new Uint8Array(NN);
  const nA = makeNoise2D(seed), nB = makeNoise2D(seed + 1), nC = makeNoise2D(seed + 2), nD = makeNoise2D(seed + 3);

  // Pass 1: base ground and the tier masks.
  const m1 = new Uint8Array(NN), m2 = new Uint8Array(NN), mb = new Uint8Array(NN), bIdx = new Int16Array(NN).fill(-1);
  const edgeA = new Float32Array(NN);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + i * cell, z = -half + j * cell, k = j * N + i;
    let h = 6 + fbm(nA, x * 0.004, z * 0.004, 4) * 10;
    const sf = Math.max(1 - smoothstep(170, 300, Math.hypot(x - 60, z + 90)), 1 - smoothstep(80, 170, Math.hypot(x - 430, z - 360)));
    h = lerp(h, 3 + fbm(nB, x * 0.02, z * 0.02, 2) * 0.5, sf);
    const edgeD = Math.max(Math.abs(x), Math.abs(z));
    const edge = smoothstep(360, 560, edgeD);
    // mesa field (same layout as before) with a rough rim: gullies and spurs instead of smooth contours
    const mn = fbm(nC, x * 0.006, z * 0.006, 3) + edge * 0.4 - 0.16 - sf * 0.5 + fbm(nD, x * 0.03, z * 0.03, 2) * 0.045;
    m1[k] = mn > 0.05 ? 1 : 0;
    m2[k] = mn > 0.22 ? 1 : 0;
    const dune = smoothstep(200, 340, z) * smoothstep(-120, 40, x) * (1 - sf);
    if (dune > 0) h += Math.pow(0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.012 + fbm(nA, x * 0.01, z * 0.01, 2) * 5), 2.2) * 8 * dune;
    h += 26 * Math.exp(-((x + 205) ** 2 + (z + 515) ** 2) / (2 * 60 * 60));
    H[k] = h; saltW[k] = sf; edgeA[k] = edge;
  }
  // Buttes: noisy ellipses stamped into their own mask.
  const zones = rampZones();
  const buttes = pickButtes(seed, 16, zones);
  buttes.forEach((b, bi) => {
    const R = b.rx * 1.3 + 50, c = Math.cos(b.rot), s = Math.sin(b.rot);
    const i0 = Math.max(0, Math.floor((b.x - R + half) / cell)), i1 = Math.min(N - 1, Math.ceil((b.x + R + half) / cell));
    const j0 = Math.max(0, Math.floor((b.z - R + half) / cell)), j1 = Math.min(N - 1, Math.ceil((b.z + R + half) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = -half + i * cell - b.x, dz = -half + j * cell - b.z, k = j * N + i;
      const lx = dx * c + dz * s, lz = -dx * s + dz * c, a = Math.atan2(lz, lx);
      const wob = 1 + 0.16 * Math.sin(a * 3 + b.seed) + 0.09 * Math.sin(a * 7 + b.seed * 2.3) + fbm(nD, (b.x + dx) * 0.06, (b.z + dz) * 0.06, 2) * 0.12;
      const rr = Math.hypot(lx / b.rx, lz / b.rz) / wob;
      if (rr < 1) mb[k] = 1;
      if (bIdx[k] < 0 || Math.hypot(dx, dz) < Math.hypot(-half + i * cell - buttes[bIdx[k]].x, -half + j * cell - buttes[bIdx[k]].z)) bIdx[k] = bi;
    }
  });
  const sd1 = signedDistance(m1, N, cell), sd2 = signedDistance(m2, N, cell), sdb = signedDistance(mb, N, cell);
  // each butte's cliff band fits inside its own footprint, so every butte keeps a flat caprock (no pyramids)
  const bMax = new Float32Array(buttes.length);
  for (let k = 0; k < NN; k++) if (bIdx[k] >= 0 && sdb[k] > bMax[bIdx[k]]) bMax[bIdx[k]] = sdb[k];

  // Pass 2: tiers, buttes, rim escarpment and canyon, in metres from each rim.
  const nbMix = (x, z) => smoothstep(-0.2, 0.25, fbm(nB, x * 0.004 + 3.1, z * 0.004 - 1.7, 2));
  const prof = (sd, Hh, wc, wt, w) => (w <= 0.01 ? tierHeight(sd, Hh, wc, wt, 2) : w >= 0.99 ? tierHeight(sd, Hh, wc, wt, 3) : lerp(tierHeight(sd, Hh, wc, wt, 2), tierHeight(sd, Hh, wc, wt, 3), w));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + i * cell, z = -half + j * cell, k = j * N + i;
    let h = H[k];
    const edge = edgeA[k], w = nbMix(x, z);
    const n1 = fbm(nA, x * 0.011 + 7.3, z * 0.011 - 2.1, 2), n2 = fbm(nB, x * 0.009 - 4.4, z * 0.009 + 8.8, 2);
    const wc1 = 7 + 5 * (0.5 + 0.5 * n1), wt1 = 16 + 14 * (0.5 + 0.5 * n2);
    const H1 = 16 + 14 * edge;
    h += prof(sd1[k], H1, wc1, wt1, w);
    const wc2 = 6 + 4 * (0.5 + 0.5 * n2), wt2 = 12 + 8 * (0.5 + 0.5 * n1);
    h += prof(sd2[k], 14, wc2, wt2, 1 - w);
    // flat caprock with a little relief once past the cliff
    if (sd1[k] > wc1) h += fbm(nB, x * 0.05, z * 0.05, 2) * 0.7 * smoothstep(wc1, wc1 + 12, sd1[k]);
    let apron = Math.max(sd1[k] < 0 && sd1[k] > -wt1 ? 1 + sd1[k] / wt1 : 0, sd2[k] < 0 && sd2[k] > -wt2 ? (1 + sd2[k] / wt2) * 0.8 : 0);
    let cliff = Math.max(sd1[k] >= 0 && sd1[k] < wc1 + 1.5 ? 1 : 0, sd2[k] >= 0 && sd2[k] < wc2 + 1.5 ? 1 : 0);
    let top = sd1[k] > 0 ? 0.75 : 0;
    if (bIdx[k] >= 0) {
      const b = buttes[bIdx[k]], rmin = Math.min(b.rx, b.rz), wcb = Math.max(2.5, Math.min(4 + rmin * 0.3, bMax[bIdx[k]] * 0.55)), wtb = 10 + b.r * 0.6;
      h += tierHeight(sdb[k], b.H, wcb, wtb, b.nb);
      if (sdb[k] < 0 && sdb[k] > -wtb) apron = Math.max(apron, 1 + sdb[k] / wtb);
      if (sdb[k] >= 0 && sdb[k] < wcb + 1.5) cliff = 1;
      if (sdb[k] > 0) top = Math.max(top, 0.75);
    }
    // The basin rim: a stratified escarpment instead of a smooth ramp.
    const edgeD = Math.max(Math.abs(x), Math.abs(z));
    if (edgeD > 520) {
      const sdE = edgeD - 556 + fbm(nD, x * 0.02, z * 0.02, 2) * 8;
      h += tierHeight(sdE, 55, 20, 32, 4);
      if (sdE < 0 && sdE > -32) apron = Math.max(apron, 1 + sdE / 32);
      if (sdE >= 0 && sdE < 21) cliff = 1;
    }
    const c = distToPolyline(CANYON.pts, x, z);
    let canyonW = 0;
    if (c.d < CANYON.rimHalf) {
      const floor = 2 + fbm(nB, x * 0.03, z * 0.03, 2) * 0.6 - CANYON.depth + 6;
      h = lerp(Math.min(h, floor), h, canyonFill(c.d, 3));
      const s = (c.d - CANYON.floorHalf) / (CANYON.rimHalf - CANYON.floorHalf);
      if (s > -0.1 && s < 0.3) apron = Math.max(apron, 1 - Math.abs(s - 0.1) / 0.2);
      if (s >= 0.28 && s < 0.88) cliff = 1;
      canyonW = 1 - smoothstep(CANYON.floorHalf, CANYON.rimHalf, c.d);
    }
    // Ramp zones keep the gentle pre-strata ground (the same formula as before this pass), blended in over 28 m.
    const rz = rampZoneWeight(zones, x, z);
    if (rz > 0) {
      const sf = saltW[k], mn0 = fbm(nC, x * 0.006, z * 0.006, 3) + edge * 0.4 - 0.16 - sf * 0.5;
      const s1 = smoothstep(0.0, 0.1, mn0), s2 = smoothstep(0.18, 0.26, mn0);
      let h0 = H[k] + s1 * (16 + 14 * edge) + s2 * 14 + smoothstep(545, 600, edgeD) * 55;
      const prof0 = 1 - smoothstep(CANYON.floorHalf, CANYON.rimHalf, c.d);
      if (prof0 > 0) h0 = lerp(h0, Math.min(h0, 2 + fbm(nB, x * 0.03, z * 0.03, 2) * 0.6 - CANYON.depth + 6), prof0);
      h = lerp(h, h0, rz);
      apron *= 1 - rz; cliff = rz > 0.5 ? 0 : cliff; top = lerp(top, s1 * 0.7, rz);
    }
    H[k] = h;
    saltW[k] = saltW[k] * (1 - canyonW);
    screeW[k] = clamp(apron, 0, 1) * (1 - saltW[k]);
    cliffW[k] = cliff;
    mesaW[k] = Math.max(top, cliff, canyonW * 0.4);
  }

  const T = { N, S, half, cell, H, saltW, mesaW, screeW, cliffW, surf, buttes, sd1, sdb };

  const idx = (x, z) => {
    const fx = clamp((x + half) / cell, 0, N - 1.001), fz = clamp((z + half) / cell, 0, N - 1.001);
    return [fx, fz];
  };
  T.heightAt = (x, z) => {
    const [fx, fz] = idx(x, z);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
    const a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  T.normalAt = (x, z, out) => {
    const [fx, fz] = idx(x, z);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
    const a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
    const dx = ((b - a) * (1 - v) + (d - c) * v) / cell;
    const dz = ((c - a) * (1 - u) + (d - b) * u) / cell;
    out.set(-dx, 1, -dz).normalize();
    return out;
  };
  T.surfaceAt = (x, z) => {
    const [fx, fz] = idx(x, z);
    return surf[Math.round(fz) * N + Math.round(fx)];
  };

  // Flatten circles (places, plots) to their centre height.
  T.flattenPad = (x, z, r, blend = 25, target) => {
    const th = target ?? T.heightAt(x, z);
    const r2 = r + blend;
    const i0 = Math.max(0, Math.floor((x - r2 + half) / cell)), i1 = Math.min(N - 1, Math.ceil((x + r2 + half) / cell));
    const j0 = Math.max(0, Math.floor((z - r2 + half) / cell)), j1 = Math.min(N - 1, Math.ceil((z + r2 + half) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = -half + i * cell, pz = -half + j * cell;
      const d = Math.hypot(px - x, pz - z);
      const w = 1 - smoothstep(r, r2, d);
      if (w > 0) { const k = j * N + i; H[k] = lerp(H[k], th, w); mesaW[k] *= 1 - w; screeW[k] *= 1 - w; cliffW[k] *= 1 - w; }
    }
    return th;
  };

  // Called by roads: per-vertex nearest road sample blend.
  T.applyRoad = (samples, width) => {
    const reach = width / 2 + 12;
    // Where the road runs above the ground (bridge embankments) the blend widens with the height, so the
    // embankment has drivable side slopes (about 1:2.2) instead of cliffs.
    const SIDE = 2.2, scan = reach + 44;
    const minX = Math.min(...samples.map((s) => s.x)) - scan, maxX = Math.max(...samples.map((s) => s.x)) + scan;
    const minZ = Math.min(...samples.map((s) => s.z)) - scan, maxZ = Math.max(...samples.map((s) => s.z)) + scan;
    const i0 = Math.max(0, Math.floor((minX + half) / cell)), i1 = Math.min(N - 1, Math.ceil((maxX + half) / cell));
    const j0 = Math.max(0, Math.floor((minZ + half) / cell)), j1 = Math.min(N - 1, Math.ceil((maxZ + half) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = -half + i * cell, pz = -half + j * cell;
      let best = Infinity, bh = 0, bridge = false;
      for (let s = 0; s < samples.length - 1; s++) {
        const A = samples[s], B = samples[s + 1];
        if (Math.abs(A.x - px) > scan + 8 && Math.abs(B.x - px) > scan + 8) continue;
        if (Math.abs(A.z - pz) > scan + 8 && Math.abs(B.z - pz) > scan + 8) continue;
        const dx = B.x - A.x, dz = B.z - A.z, L2 = dx * dx + dz * dz || 1;
        const t = clamp(((px - A.x) * dx + (pz - A.z) * dz) / L2, 0, 1);
        const d = Math.hypot(A.x + dx * t - px, A.z + dz * t - pz);
        // The first and last 6 m of a bridge count as road, so the ground meets the deck instead of leaving a trench.
        const segLen = Math.sqrt(L2), abut = (!A.deck && t * segLen < 6) || (!B.bridge && (1 - t) * segLen < 6);
        if (d < best) { best = d; bh = A.y + (B.y - A.y) * t; bridge = A.bridge && !abut; }
      }
      const k = j * N + i;
      const outer = reach + Math.min(44, Math.max(0, bh - 0.04 - H[k]) * SIDE);
      if (best > outer || bridge) continue;
      const w = 1 - smoothstep(width / 2 + 1, outer, best);
      H[k] = lerp(H[k], bh - 0.04, w);
      mesaW[k] *= 1 - w; screeW[k] *= 1 - w; cliffW[k] *= 1 - w;
      saltW[k] *= 1 - w * 0.5;
      if (best < width / 2) surf[k] = SURF.road;
    }
  };

  // Ramp lanes. Past the lip the landing may climb at most 6% above the lip ground, so no rim apron or mesa foot rises
  // into a jump; the run-up may tilt at most 12% across; beside the run-up and landing the ground may not rise faster than a gentle bank (1:2.2 for 12 m,
  // then 1:1), so a car that lands a little off line rolls on instead of meeting a strata wall. Only ever lowers the
  // ground, and skips cells near a road or place (skip(x, z)) so no road ribbon or building is left floating.
  T.clearLane = (r, back, ahead, skip) => {
    const fx = r.dirX, fz = r.dirZ, halfW = r.w / 2 + 3, REACH = 42, lip = r.len / 2;
    const u0 = -(r.len / 2 + back), u1 = r.len / 2 + ahead;
    const base = [];
    for (let u = Math.floor(u0); u <= Math.ceil(u1); u++) base.push(T.heightAt(r.x + fx * u, r.z + fz * u));
    const raw = (a) => base[clamp(Math.round(clamp(a, u0, u1) - Math.floor(u0)), 0, base.length - 1)];
    const lipG = raw(lip);
    const ref = (a) => (a > lip ? Math.min(raw(a), lipG + 1 + (a - lip) * 0.06) : raw(a));
    const ext = Math.max(-u0, u1) + REACH + halfW;
    const i0 = Math.max(0, Math.floor((r.x - ext + half) / cell)), i1 = Math.min(N - 1, Math.ceil((r.x + ext + half) / cell));
    const j0 = Math.max(0, Math.floor((r.z - ext + half) / cell)), j1 = Math.min(N - 1, Math.ceil((r.z + ext + half) / cell));
    let lowered = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -half + i * cell, z = -half + j * cell, dx = x - r.x, dz = z - r.z;
      const a = dx * fx + dz * fz, s = dz * fx - dx * fz;
      const out = Math.max(0, Math.abs(s) - halfW) + Math.max(0, u0 - a, a - u1);
      if (out > REACH || (out <= 0 && Math.abs(a) <= lip + 2)) continue; // the ramp's own footprint stays as it is
      // inside the run-up the lane may tilt at most 12% across (a mesa foot leaning into it tips a car over)
      const inside = out <= 0 ? (a < 0 ? 0.6 + Math.abs(s) * 0.12 : 0) : 1.2 + Math.min(out, 12) / 2.2 + Math.max(0, out - 12);
      const k = j * N + i, env = ref(a) + inside;
      if (H[k] <= env || (skip && skip(x, z))) continue;
      H[k] = env; cliffW[k] = 0; mesaW[k] *= 0.4; screeW[k] = Math.max(screeW[k] * 0.5, 0.35);
      lowered++;
    }
    return lowered;
  };

  // A ramp spot that no flat-spot try fits (mesa feet, rim aprons): level its footprint to its centre height, with a
  // 12 m blend, so the ramp is placed instead of left out. Road cells are left alone.
  T.levelSpot = (p, len, w) => {
    const fx = p.dirX, fz = p.dirZ, th = T.heightAt(p.x, p.z), A = len / 2 + 4, B = w / 2 + 3, BL = 12, ext = A + B + BL;
    const i0 = Math.max(0, Math.floor((p.x - ext + half) / cell)), i1 = Math.min(N - 1, Math.ceil((p.x + ext + half) / cell));
    const j0 = Math.max(0, Math.floor((p.z - ext + half) / cell)), j1 = Math.min(N - 1, Math.ceil((p.z + ext + half) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * N + i;
      if (surf[k] === SURF.road) continue;
      const dx = -half + i * cell - p.x, dz = -half + j * cell - p.z;
      const a = Math.abs(dx * fx + dz * fz), s = Math.abs(dz * fx - dx * fz);
      const d = Math.hypot(Math.max(0, a - A), Math.max(0, s - B));
      const wgt = 1 - smoothstep(0, BL, d);
      if (wgt <= 0) continue;
      H[k] = lerp(H[k], th, wgt); cliffW[k] *= 1 - wgt; mesaW[k] *= 1 - wgt; screeW[k] *= 1 - wgt;
    }
  };

  T.buildMesh = (tex) => {
    const n = new THREE.Vector3();
    const spl = new Float32Array(NN * 2), col = new Float32Array(NN * 3), look = new Float32Array(NN * 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -half + i * cell, z = -half + j * cell;
      T.normalAt(x, z, n);
      const steep = smoothstep(0.88, 0.7, n.y);
      const rock = Math.max(steep, mesaW[k] * 0.8);
      spl[k * 2] = saltW[k]; spl[k * 2 + 1] = clamp(rock, 0, 1);
      look[k * 2] = screeW[k]; look[k * 2 + 1] = cliffW[k];
      if (surf[k] !== SURF.road) surf[k] = rock > 0.5 ? SURF.rock : saltW[k] > 0.5 ? SURF.salt : SURF.sand;
      const v = 0.9 + fbm(nA, x * 0.03, z * 0.03, 2) * 0.18;
      col[k * 3] = v; col[k * 3 + 1] = v * 0.98; col[k * 3 + 2] = v * 0.95;
    }
    // Road shoulders: a soft mask a few metres around road cells (gravel and dust in the shader).
    const road = new Float32Array(NN), RW = 3;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (surf[j * N + i] !== SURF.road) continue;
      for (let dj = -RW; dj <= RW; dj++) for (let di = -RW; di <= RW; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        const w = 1 - Math.hypot(di, dj) / (RW + 0.5);
        const kk = jj * N + ii;
        if (w > road[kk]) road[kk] = w;
      }
    }
    // Normals from central differences of the height grid: crisp enough for the strata ledges, no faceting.
    const nor = new Float32Array(NN * 3);
    const h = (i, j) => H[clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * cell), dz = (h(i, j + 1) - h(i, j - 1)) / (2 * cell);
      const l = Math.hypot(dx, 1, dz), k = (j * N + i) * 3;
      nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
    }
    const mat = createTerrainMaterial(tex);
    const depth = terrainShadowDepth();
    const group = new THREE.Group();
    group.name = "terrain";
    const CS = SEG / CHUNKS, CN = CS + 1;
    const index = new Uint32Array(CS * CS * 6);
    let p = 0;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const a = j * CN + i, b = a + 1, c = a + CN, d = c + 1;
      index[p++] = a; index[p++] = c; index[p++] = b; index[p++] = b; index[p++] = c; index[p++] = d;
    }
    const indexAttr = new THREE.BufferAttribute(index, 1);
    for (let cj = 0; cj < CHUNKS; cj++) for (let ci = 0; ci < CHUNKS; ci++) {
      const pos = new Float32Array(CN * CN * 3), cn = new Float32Array(CN * CN * 3), cc = new Float32Array(CN * CN * 3);
      const cs = new Float32Array(CN * CN * 2), cl = new Float32Array(CN * CN * 2), cr = new Float32Array(CN * CN);
      for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
        const gi = ci * CS + i, gj = cj * CS + j, k = gj * N + gi, o = j * CN + i;
        pos[o * 3] = -half + gi * cell; pos[o * 3 + 1] = H[k]; pos[o * 3 + 2] = -half + gj * cell;
        for (let q = 0; q < 3; q++) { cn[o * 3 + q] = nor[k * 3 + q]; cc[o * 3 + q] = col[k * 3 + q]; }
        cs[o * 2] = spl[k * 2]; cs[o * 2 + 1] = spl[k * 2 + 1];
        cl[o * 2] = look[k * 2]; cl[o * 2 + 1] = look[k * 2 + 1];
        cr[o] = road[k];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(cn, 3));
      g.setAttribute("color", new THREE.BufferAttribute(cc, 3));
      g.setAttribute("splat", new THREE.BufferAttribute(cs, 2));
      g.setAttribute("look", new THREE.BufferAttribute(cl, 2));
      g.setAttribute("roadW", new THREE.BufferAttribute(cr, 1));
      g.setIndex(indexAttr);
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = true; // mesas throw long late-afternoon shadows across the flats
      mesh.customDepthMaterial = depth;
      mesh.name = "terrain-chunk";
      group.add(mesh);
    }
    T.mesh = group;
    return group;
  };

  return T;
}
