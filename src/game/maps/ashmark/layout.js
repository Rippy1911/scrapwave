// The Ashmark Expanse: a fixed, hand-shaped layout, the same every visit. 10 km x 10 km in 250 m tiles.
// Map coordinates are centred on the map (x east, z south, so north is -z); the world position adds ASH.site,
// which stands the map north of the Saltreach so the two never overlap (the Saltreach stays loaded and hidden).
// Biomes: Old Varrow (ruined city, south-west), the Spine (mountains across the north), the Sallow Sea (dunes,
// east), the Drownings (salt marsh, south-east) and the Ashmark Flats (Saltreach-style wasteland) in the centre.
import { smoothstep, lerp } from "@/game/core/rng";

export const ASH = { size: 10000, half: 5000, tile: 250, tiles: 40, site: { x: 0, z: -5750 }, sea: 0, seed: 7341, band: 200, play: 4850 };
export const BIOMES = ["city", "spine", "dunes", "marsh", "waste"];
export const BIOME_NAME = { city: "Old Varrow", spine: "The Spine", dunes: "The Sallow Sea", marsh: "The Drownings", waste: "Ashmark Flats" };

// Hand-drawn borders (metres). Each blends over 2 * ASH.band = 400 m.
export const spineLine = (x) => -1500 + 340 * Math.sin(x / 1400 + 0.6) + 180 * Math.sin(x / 610 + 2.1); // the Spine is north of it
export const eastLine = (z) => lerp(1500, 500, smoothstep(600, 1600, z)) + 280 * Math.sin(z / 1150 + 1.3); // dunes and marsh are east of it
export const splitLine = (x) => 800 + 240 * Math.sin(x / 900 + 0.4); // dunes north of it, marsh south
const citySd = (x, z) => Math.max(Math.abs(x + 2850) - 1850, Math.abs(z - 2650) - 2050) + 110 * Math.sin(x / 700 + z / 520);

/** Biome weights at a map point (they sum to 1). Writes o.city, o.spine, o.dunes, o.marsh, o.waste. */
export function weights(x, z, o) {
  const B = ASH.band;
  const s = 1 - smoothstep(-B, B, z - spineLine(x));
  const c = (1 - smoothstep(-B, B, citySd(x, z))) * (1 - s);
  const rem = 1 - s - c;
  const e = smoothstep(-B, B, x - eastLine(z)) * rem, k = smoothstep(-B, B, z - splitLine(x));
  o.spine = s; o.city = c; o.dunes = e * (1 - k); o.marsh = e * k; o.waste = Math.max(0, rem - e);
  return o;
}
const W = { city: 0, spine: 0, dunes: 0, marsh: 0, waste: 0 };
export function biomeAtMap(x, z) {
  weights(x, z, W);
  let best = "waste";
  for (const b of BIOMES) if (W[b] > W[best]) best = b;
  return best;
}

// The pass road over the Spine: [x, z, road height]. A long first leg, five switchbacks, the saddle, then down into
// the high basin behind the crest. The ground is cut and filled to it (height.js); the road itself is a later part.
export const PASS = [[-500, -1250, 24], [-520, -2050, 62], [-300, -2250, 84], [-620, -2380, 112], [-300, -2520, 140], [-640, -2660, 168], [-420, -2860, 196], [-440, -3060, 205], [-700, -3400, 176], [-900, -3800, 150]];
// The gorge that drains the high basin east to the dunes. The broken dam stands at DAM; the tunnel runs under TUNNEL.
export const GORGE = [[-900, -3800, 146], [200, -3700, 130], [1400, -3500, 108], [2400, -3150, 70], [3200, -2500, 34], [3750, -1050, 13]];
export const DAM = { x: 1400, z: -3500 };
export const TUNNEL = { a: [900, -2300], b: [1500, -2900] };
// Level ground: [x, z, radius, height].
export const PADS = [[0, 0, 70, 9]];

// Where the hooks and the check put you, and the line the check drives (map coordinates).
export const SPOTS = {
  waste: [[0, 0], [0, -600]],
  city: [[-3700, 1700], [-2600, 2300], [-1900, 3300]],
  spine: PASS.map((p) => [p[0], p[1]]),
  dunes: [[2600, -600], [3500, -300], [4200, 300]],
  marsh: [[1900, 2300], [2800, 2800], [3600, 3600]],
};

export const toMapX = (wx) => wx - ASH.site.x;
export const toMapZ = (wz) => wz - ASH.site.z;
export const inMap = (wx, wz) => Math.abs(wx - ASH.site.x) <= ASH.half && Math.abs(wz - ASH.site.z) <= ASH.half;
export const tileX0 = (i) => ASH.site.x - ASH.half + i * ASH.tile; // world x of a tile's west edge
export const tileZ0 = (j) => ASH.site.z - ASH.half + j * ASH.tile; // world z of a tile's north edge
const clampT = (t) => (t < 0 ? 0 : t > ASH.tiles - 1 ? ASH.tiles - 1 : t);
export const tileI = (wx) => clampT(Math.floor((wx - ASH.site.x + ASH.half) / ASH.tile));
export const tileJ = (wz) => clampT(Math.floor((wz - ASH.site.z + ASH.half) / ASH.tile));

// The map's picture for its card: the five biomes from above, north up.
const RGB = { city: [91, 90, 88], spine: [141, 130, 115], dunes: [201, 165, 107], marsh: [79, 106, 102], waste: [165, 138, 106] };
export function drawAshmark(ctx, w, h) {
  const n = 40, s = (Math.min(w, h) * 0.94) / n, x0 = (w - n * s) / 2, y0 = (h - n * s) / 2;
  ctx.fillStyle = "#1f2c2e"; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    weights(-ASH.half + (i + 0.5) * ASH.tile, -ASH.half + (j + 0.5) * ASH.tile, W);
    const c = [0, 1, 2].map((q) => Math.round(BIOMES.reduce((a, b) => a + W[b] * RGB[b][q], 0)));
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(x0 + i * s, y0 + j * s, s + 0.5, s + 0.5);
  }
  ctx.strokeStyle = "#f2c230"; ctx.lineWidth = 1.5; ctx.beginPath();
  PASS.forEach((p, k) => { const X = x0 + ((p[0] + ASH.half) / ASH.tile) * s, Y = y0 + ((p[1] + ASH.half) / ASH.tile) * s; if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
  ctx.stroke();
}