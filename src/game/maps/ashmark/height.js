// The Ashmark ground: heightAt(x, z) is an analytic function of the biome layout plus seeded noise. Nothing is
// stored for the whole map; tiles (tileData.js) sample it as they stream in. Heights are metres above the sea (0).
import { ASH, weights, biomeAtMap, spineLine, PASS, GORGE, PADS } from "@/game/maps/ashmark/layout";
import { makeNoise } from "@/game/maps/ashmark/noise";
import { smoothstep, lerp } from "@/game/core/rng";

const N1 = makeNoise(ASH.seed), N2 = makeNoise(ASH.seed + 1), N3 = makeNoise(ASH.seed + 2);
const W0 = { city: 0, spine: 0, dunes: 0, marsh: 0, waste: 0 };

// Nearest point on a polyline of [x, z, y]: its distance lands in lineD and its height in lineY (no allocation).
let lineD = 0, lineY = 0;
function nearest(P, x, z) {
  let best = Infinity, by = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t - x, pz = a[1] + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; by = a[2] + (b[2] - a[2]) * t; }
  }
  lineD = Math.sqrt(best); lineY = by;
}
// The hillside the pass climbs: its node heights read by z (every node is north of the one before), so each
// straight leg lies on the slope and the road needs only a shallow bed.
function passSlope(z) {
  if (z >= PASS[0][1]) return PASS[0][2];
  for (let i = 0; i < PASS.length - 1; i++) {
    const a = PASS[i], b = PASS[i + 1];
    if (z >= b[1]) return a[2] + ((b[2] - a[2]) * (a[1] - z)) / (a[1] - b[1]);
  }
  return PASS[PASS.length - 1][2];
}

// Ashmark Flats: salt flats, two-step mesas and salt pans, in the style of the Saltreach.
function waste(x, z) {
  let h = 9 + 6 * N1.fbm(x * 0.0035, z * 0.0035, 4);
  const m = N2.fbm(x * 0.0017 + 5.2, z * 0.0017 - 3.1, 3);
  h += 24 * smoothstep(0.16, 0.2, m) + 18 * smoothstep(0.34, 0.37, m);
  const pan = smoothstep(0.22, 0.4, -N3.noise(x * 0.0011 + 9.7, z * 0.0011 + 2.3));
  return lerp(h, 5.5 + 0.3 * N1.noise(x * 0.02, z * 0.02), pan);
}
// Old Varrow: a level plateau with shallow sunken blocks.
const city = (x, z) => 14 + 1.8 * N1.fbm(x * 0.004, z * 0.004, 2) - 3 * smoothstep(0.45, 0.62, N3.noise(x * 0.006, z * 0.006));
// The Sallow Sea: long dunes with wind ripples, far deeper toward the east edge.
function dunes(x, z) {
  const warp = N3.noise(x * 0.0021, z * 0.0021) * 2.6;
  const big = Math.pow(0.5 + 0.5 * Math.sin((x * 0.62 + z * 0.78) * 0.021 + warp), 1.6);
  const amp = 14 + 12 * (0.5 + 0.5 * N2.noise(x * 0.0012, z * 0.0012)) + 26 * smoothstep(4300, 4950, x);
  return 10 + big * amp + 1.6 * Math.sin((x * 0.9 - z * 0.44) * 0.13 + warp * 3) + 2.2 * N1.fbm(x * 0.008, z * 0.008, 2);
}
// The Drownings: hummocks and channels around the water line (at most about 1.5 m deep), the open sea at the edges.
function marsh(x, z) {
  const ch = Math.abs(N2.noise(x * 0.0045, z * 0.0045));
  return -1.05 + 1.9 * smoothstep(0, 0.34, ch) + 0.5 * N1.fbm(x * 0.02, z * 0.02, 2) - 7 * smoothstep(4600, 4950, Math.max(x, z));
}
// The Spine: ridged peaks, cliff benches every 60 m, a high basin behind the crest and walls at the north and east edges.
function spine(x, z) {
  const E = smoothstep(-100, 900, spineLine(x) - z);
  let h = 26 + E * (150 + 300 * N1.ridged(x * 0.0012, z * 0.0012, 4) + 28 * N2.fbm(x * 0.006, z * 0.006, 3));
  const q = h / 60, f = q - Math.floor(q);
  h = lerp(h, (Math.floor(q) + smoothstep(0.3, 0.7, f)) * 60, 0.4 * E);
  const basin = Math.exp(-(((z + 3800) / 520) ** 2)) * (1 - smoothstep(2200, 3000, Math.abs(x + 200)));
  h = lerp(h, 150 + 10 * N2.fbm(x * 0.004, z * 0.004, 2), 0.85 * basin);
  return h + 260 * smoothstep(-4350, -4950, z) + 200 * smoothstep(4500, 4950, x);
}

// The grading pass: roads.js sets it once its roads are laid out (it reads the ungraded ground to do that).
let grade = null;
export const setGrade = (fn) => { grade = fn; };

/** Height at a map point. Fills w (city, spine, dunes, marsh, waste) with the biome weights there. */
export function mapHeight(x, z, w = W0) {
  weights(x, z, w);
  let h = 0;
  if (w.waste > 0) h += w.waste * waste(x, z);
  if (w.city > 0) h += w.city * city(x, z);
  if (w.dunes > 0) h += w.dunes * dunes(x, z);
  if (w.marsh > 0) h += w.marsh * marsh(x, z);
  if (w.spine > 0) h += w.spine * spine(x, z);
  // The gorge: a V cut with 22 m of level floor.
  if (z < -700 && z > -4150 && x > -1250 && x < 4100) {
    nearest(GORGE, x, z);
    if (lineD < 320) h = lerp(h, Math.min(h, lineY + Math.max(0, lineD - 22) * 0.9), smoothstep(320, 220, lineD));
  }
  // The pass: a broad even hillside, then the road bed cut level across it.
  if (z < -830 && z > -4220 && x > -1320 && x < 120) {
    nearest(PASS, x, z);
    if (lineD < 420) {
      h = lerp(h, passSlope(z) + 3 * N2.fbm(x * 0.01, z * 0.01, 2), smoothstep(420, 150, lineD));
      h = lerp(h, lineY, smoothstep(34, 9, lineD));
    }
  }
  for (const p of PADS) {
    const d = Math.hypot(x - p[0], z - p[1]);
    if (d < p[2] + 40) h = lerp(h, p[3], smoothstep(p[2] + 40, p[2], d));
  }
  if (grade) h = grade(x, z, h); // roads and site pads cut and fill the ground (roads.js)
  // Sea cliffs along the west and south edges.
  const sea = Math.max(smoothstep(4780, 4830, -x), smoothstep(4780, 4830, z));
  if (sea > 0) h = lerp(h, -9 + 1.5 * N1.noise(x * 0.01, z * 0.01), sea);
  return h;
}

const clampM = (v) => (v < -ASH.half ? -ASH.half : v > ASH.half ? ASH.half : v);
/** Height at a world point; past the map edge it continues level. */
export const heightAt = (wx, wz, w) => mapHeight(clampM(wx - ASH.site.x), clampM(wz - ASH.site.z), w);
export function normalAt(wx, wz, out) {
  const dx = (heightAt(wx + 2, wz) - heightAt(wx - 2, wz)) / 4, dz = (heightAt(wx, wz + 2) - heightAt(wx, wz - 2)) / 4, l = Math.hypot(dx, 1, dz);
  return out.set(-dx / l, 1 / l, -dz / l);
}
export const biomeAt = (wx, wz) => biomeAtMap(wx - ASH.site.x, wz - ASH.site.z);
// The old terrain's surface codes (world/terrain.js SURF): 0 sand, 1 salt, 2 rock, 3 road.
export const surfaceAt = (wx, wz) => ({ city: 3, spine: 2, dunes: 0, marsh: 1, waste: 1 })[biomeAt(wx, wz)];