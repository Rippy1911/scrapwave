// Landforms for the Saltreach heightfield: mesas and buttes with vertical strata cliffs, ledges, a flat caprock and a
// concave scree apron at the foot, plus a terraced canyon wall. Everything is in the height grid itself, so the
// physics heightfield (vehicles/rapier.js reads T.H) and the rendered terrain are the same surface.
//
// Shape from distance, not from the raw noise value: each tier's footprint is a mask on the grid, an exact Euclidean
// distance transform gives metres inside and outside its rim, and the profile is drawn in metres:
//   outside  0..W_talus   scree apron, concave, up to APRON of the tier height
//   inside   0..W_cliff   cliff in NB strata: a steep riser, then a ledge, per band
//   beyond   caprock      flat top with a little relief
import { smoothstep, clamp, distToPolyline, mulberry32 } from "@/game/core/rng";
import { ROADS, PLACES, PLOTS, RAMPS, CRASH_SITES, BILLBOARDS, CANYON } from "@/game/data/places";
import { sampleRoad } from "@/game/world/roads";

export const APRON = 0.24;

/** Exact squared Euclidean distance transform (Felzenszwalb-Huttenlocher) of a 0/1 grid: distance (in cells) to the
 * nearest cell where on[k] === 1. Returns Float32Array of distances in cells. */
export function edt(on, N) {
  const INF = 1e12, f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const g = new Float64Array(N * N);
  for (let k = 0; k < N * N; k++) g[k] = on[k] ? 0 : INF;
  const pass = (get, set) => {
    for (let line = 0; line < N; line++) {
      for (let q = 0; q < N; q++) f[q] = get(line, q);
      let kk = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < N; q++) {
        let s;
        for (;;) {
          const p = v[kk];
          s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
          if (s <= z[kk] && kk > 0) kk--; else break;
        }
        if (s <= z[kk]) { v[0] = q; z[0] = -INF; z[1] = INF; kk = 0; continue; }
        kk++; v[kk] = q; z[kk] = s; z[kk + 1] = INF;
      }
      kk = 0;
      for (let q = 0; q < N; q++) { while (z[kk + 1] < q) kk++; const p = v[kk]; d[q] = (q - p) * (q - p) + f[p]; }
      for (let q = 0; q < N; q++) set(line, q, d[q]);
    }
  };
  pass((j, i) => g[j * N + i], (j, i, x) => { g[j * N + i] = x; });
  pass((i, j) => g[j * N + i], (i, j, x) => { g[j * N + i] = x; });
  const out = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) out[k] = Math.sqrt(g[k]);
  return out;
}

/** Signed distance in metres: > 0 inside the mask (to its rim), < 0 outside. */
export function signedDistance(mask, N, cell) {
  const inv = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) inv[k] = mask[k] ? 0 : 1;
  const dOut = edt(mask, N), dIn = edt(inv, N);
  const sd = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) sd[k] = mask[k] ? (dIn[k] - 0.5) * cell : -(dOut[k] - 0.5) * cell;
  return sd;
}

/** Strata cliff: u in 0..1 across the cliff band -> 0..1 of its height, nb bands of steep riser + ledge. */
export function strata(u, nb, riser = 0.42) {
  const t = clamp(u, 0, 1) * nb, i = Math.min(nb - 1, Math.floor(t)), fr = t - i;
  return (i + smoothstep(0, riser, fr)) / nb;
}

/**
 * Height of one tier at signed distance sd (metres): apron outside, strata cliff inside, flat beyond.
 * H tier height, wc cliff width, wt apron width, nb strata count.
 */
export function tierHeight(sd, H, wc, wt, nb) {
  if (sd <= -wt) return 0;
  if (sd <= 0) { const a = 1 + sd / wt; return H * APRON * a * a; }
  return H * (APRON + (1 - APRON) * strata(sd / wc, nb));
}

/** Canyon fill 0 (floor) .. 1 (untouched ground) by distance from the centre line: scree, strata wall, rim lip. */
export function canyonFill(d, nb) {
  const s = clamp((d - CANYON.floorHalf) / (CANYON.rimHalf - CANYON.floorHalf), 0, 1);
  if (s < 0.3) { const a = s / 0.3; return 0.2 * a * a; }
  if (s < 0.86) return 0.2 + 0.8 * strata((s - 0.3) / 0.56, nb);
  return 1;
}

// Seeded buttes: free-standing strata towers on open ground, clear of roads, places, plots, ramps and the canyon.
export function pickButtes(seed, n = 16, zones = []) {
  const r = mulberry32(seed + 77), out = [];
  const roadLines = ROADS.map((d) => d.pts.map((p) => [p[0], p[1]]));
  const clear = (x, z, rad) => {
    if (Math.abs(x) > 500 || Math.abs(z) > 500) return false;
    for (const pl of roadLines) if (distToPolyline(pl, x, z).d < rad + 38) return false;
    for (const p of PLACES) if (Math.hypot(p.x - x, p.z - z) < (p.pad || p.r) + rad + 45) return false;
    for (const p of PLOTS) if (Math.hypot(p.x - x, p.z - z) < rad + 70) return false;
    for (const p of RAMPS) if (p.x !== undefined && Math.hypot(p.x - x, p.z - z) < rad + 70) return false;
    for (const [cx, cz] of CRASH_SITES) if (Math.hypot(cx - x, cz - z) < rad + 40) return false;
    for (const b of BILLBOARDS) if (Math.hypot(b.x - x, b.z - z) < rad + 30) return false;
    if (distToPolyline(CANYON.pts, x, z).d < CANYON.rimHalf + rad + 25) return false;
    for (const b of out) if (Math.hypot(b.x - x, b.z - z) < b.r + rad + 60) return false;
    for (const q of zones) if (Math.hypot(q.x - x, q.z - z) < rad + 110) return false;
    return true;
  };
  for (let tries = 0; tries < 900 && out.length < n; tries++) {
    const x = (r() - 0.5) * 1000, z = (r() - 0.5) * 1000;
    const rx = 13 + r() * 14, rz = rx * (0.6 + r() * 0.35);
    if (!clear(x, z, rx)) continue;
    out.push({ x, z, r: rx, rx, rz, rot: r() * Math.PI, H: 15 + r() * 19, nb: 2 + Math.floor(r() * 3), seed: r() * 100 });
  }
  return out;
}

// Ramp footprints (length, width) as in places/ramps.js SPECS.
export const RAMP_SIZE = { kicker: [12, 7], mound: [16, 10], carrier: [14, 4.4], bus: [11, 3], dune: [22, 16] };

/** Every ramp's primary spot, resolved from the data the way roads.js resolves it (spline samples, arc length,
 * side offset), before any road exists: [{ x, z, dirX, dirZ, len, w }]. */
export function rampZones() {
  const roads = {};
  for (const d of ROADS) {
    const s = sampleRoad(d);
    let len = 0;
    for (let i = 0; i < s.length; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      s[i].dx = (b.x - a.x) / l; s[i].dz = (b.z - a.z) / l;
      if (i > 0) len += Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z);
      s[i].s = len;
    }
    roads[d.id] = { s, len };
  }
  return RAMPS.map((d) => {
    const [len, w] = RAMP_SIZE[d.type] || RAMP_SIZE.kicker;
    if (d.road) {
      const r = roads[d.road], target = d.s ?? d.t * r.len;
      let i = 0; while (i < r.s.length - 1 && r.s[i].s < target) i++;
      const q = r.s[i], sign = d.rev ? -1 : 1;
      return { x: q.x - q.dz * d.off, z: q.z + q.dx * d.off, dirX: q.dx * sign, dirZ: q.dz * sign, len, w };
    }
    const h = (d.heading * Math.PI) / 180;
    return { x: d.x, z: d.z, dirX: Math.sin(h), dirZ: -Math.cos(h), len, w };
  });
}

/** 1 inside a ramp's zone (run-up, the ramp, the flight and roll-out, the spare spots along its road), fading to 0 over
 * 28 m: the terrain there keeps the gentle pre-strata shape, so every jump flies and lands as it always did. */
export function rampZoneWeight(zones, x, z) {
  let w = 0;
  for (const r of zones) {
    const dx = x - r.x, dz = z - r.z;
    if (dx > 220 || dx < -220 || dz > 220 || dz < -220) continue;
    const a = dx * r.dirX + dz * r.dirZ, s = dz * r.dirX - dx * r.dirZ;
    const d = Math.hypot(Math.max(0, -(r.len / 2 + 70) - a, a - (r.len / 2 + 110)), Math.max(0, Math.abs(s) - (r.w / 2 + 16)));
    w = Math.max(w, 1 - smoothstep(0, 28, d));
    if (w >= 1) break;
  }
  return w;
}
