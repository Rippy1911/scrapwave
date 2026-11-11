// Brasswater City, the plan: pure data, no three.js, so the map picker can lay it out in a millisecond and a node
// script can count it. Metres from the city centre, +x east, +z south (the map is drawn north up), y up from the deck.
//
//   - a 100 m street grid (avenues 24 m wide every third line, side streets 14 m) inside a 622 m ring road;
//   - downtown towers on the central plaza, midtown blocks, low outskirts, rooftop routes with jump ramps;
//   - five zones that replace blocks: the airfield (north), the park (west), the stadium (east), the harbour (south)
//     and the plaza with the tunnel under it (centre).
// Everything is deterministic: the same city every time, on every client.

export const CITY = { R: 700, G: 100, AVE: 24, ST: 14, WALK: 5, RING0: 622, RING1: 652, INNER: 612, LINES: 6 };
export const ZONES = {
  airfield: { x0: -320, x1: 320, z0: -600, z1: -400 },
  park: { x0: -400, x1: -200, z0: -100, z1: 100 },
  harbour: { x0: -340, x1: 160, z0: 400, z1: 640 },
  stadium: { cx: 400, cz: 100, r: 92 },
  plaza: { x0: -100, x1: 100, z0: -100, z1: 100 },
};
// Rooftop routes: a row of blocks with flat roofs of one height, an access ramp up from the first corner, kickers
// between the roofs and a ramp down at the far end. dir +1 runs east, -1 west. Each is { j, i0, n, h, dir }.
export const ROUTES = [
  { name: "Tin Row", j: -3, i0: -3, n: 3, h: 18, dir: 1 },
  { name: "Copper Run", j: 2, i0: 0, n: 3, h: 24, dir: -1 },
  { name: "Slate Strip", j: 3, i0: -3, n: 3, h: 14, dir: 1 },
];
export const RUNWAY = { cx: 0, cz: -527, hl: 300, hw: 20 };
export const PLAZA_H = 8; // the central plaza deck; the avenues pass under it in a tunnel 6 m high

export const hw = (k) => (((k % 3) + 3) % 3 === 0 ? CITY.AVE / 2 : CITY.ST / 2); // half road width of grid line k
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const rectCircle = (r, c) => { const x = Math.max(r.x0, Math.min(c.cx, r.x1)), z = Math.max(r.z0, Math.min(c.cz, r.z1)); return Math.hypot(x - c.cx, z - c.cz) < c.r; };
const inside = (p, r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

export const PALETTE = {
  office: ["#6e7f8c", "#566470", "#8a97a0", "#4b5a66", "#7d8d96"],
  apartment: ["#9a6a52", "#b08a6a", "#8a7260", "#a58f78", "#7b5d4c"],
  shop: ["#b9a27a", "#9c8a6e", "#c4b08e", "#8e7b66"],
  warehouse: ["#7d7a70", "#8d6a4a", "#6c7468"],
};
export const CAR_COLOURS = ["#8c3b55", "#2f7a74", "#d9b23a", "#3f5f6e", "#b23a1f", "#5e6b3a", "#7d8a80", "#c7762e", "#2c2a28", "#d8d2c4"];

function blockRect(i, j) {
  const G = CITY.G, W = CITY.WALK;
  return { x0: i * G + hw(i) + W, x1: (i + 1) * G - hw(i + 1) - W, z0: j * G + hw(j) + W, z1: (j + 1) * G - hw(j + 1) - W, i, j };
}
function split(r, nx, nz, gap) {
  const out = [], w = (r.x1 - r.x0 - gap * (nx - 1)) / nx, d = (r.z1 - r.z0 - gap * (nz - 1)) / nz;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const x0 = r.x0 + a * (w + gap), z0 = r.z0 + b * (d + gap);
    out.push({ x0, x1: x0 + w, z0, z1: z0 + d });
  }
  return out;
}

export function buildPlan() {
  const rng = mulberry(20261110);
  const P = {
    blocks: [], buildings: [], lots: [], lawns: [], alleys: [], routes: [], helipads: [], shops: [],
    spawns: [], air: [], horde: [], power: [], cps: [], props: [], roofSpots: [], skipped: 0,
  };
  const routeOf = (i, j) => ROUTES.find((r) => r.j === j && i >= r.i0 && i < r.i0 + r.n) || null;
  const circle = ZONES.stadium;

  for (let i = -CITY.LINES; i < CITY.LINES; i++) for (let j = -CITY.LINES; j < CITY.LINES; j++) {
    const r = blockRect(i, j), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]];
    if (corners.some(([x, z]) => Math.hypot(x, z) > CITY.INNER)) { P.skipped++; continue; }
    if (hit(r, ZONES.plaza) || hit(r, ZONES.airfield) || hit(r, ZONES.harbour) || rectCircle(r, circle)) { P.skipped++; continue; }
    if (hit(r, ZONES.park)) { P.lawns.push(r); continue; }
    P.blocks.push({ ...r, cx, cz });
    const d = Math.hypot(cx, cz), route = routeOf(i, j);
    const tier = d < 300 ? "core" : d < 470 ? "mid" : "low";
    if (route) { genRoute(P, r, route, i, rng); continue; }

    const roll = rng();
    let pattern;
    if (tier === "core") pattern = roll < 0.5 ? "tower" : roll < 0.85 ? "twin" : "quad";
    else if (tier === "mid") pattern = roll < 0.2 ? "one" : roll < 0.55 ? "twin" : roll < 0.9 ? "quad" : "court";
    else pattern = roll < 0.15 ? "one" : roll < 0.45 ? "quad" : roll < 0.75 ? "row" : "court";
    const wide = (i * 7 + j * 3) % 5 === 0 ? 13 : 8; // some blocks keep a wide, straight alley as a shortcut
    let lots;
    if (pattern === "tower" || pattern === "one") lots = [r];
    else if (pattern === "twin") lots = rng() < 0.5 ? split(r, 2, 1, wide) : split(r, 1, 2, wide);
    else if (pattern === "row") lots = rng() < 0.5 ? split(r, 3, 1, 8) : split(r, 1, 3, 8);
    else lots = split(r, 2, 2, wide);
    if (lots.length > 1) {
      const v = lots.length === 2 ? (lots[0].x1 < lots[1].x0 ? 0 : 1) : -1; // alley rects for the ground mask
      if (v === 0) P.alleys.push({ x0: lots[0].x1, x1: lots[1].x0, z0: r.z0, z1: r.z1 });
      if (v === 1) P.alleys.push({ x0: r.x0, x1: r.x1, z0: lots[0].z1, z1: lots[1].z0 });
      if (lots.length === 4) { P.alleys.push({ x0: lots[0].x1, x1: lots[2].x0, z0: r.z0, z1: r.z1 }); P.alleys.push({ x0: r.x0, x1: r.x1, z0: lots[0].z1, z1: lots[1].z0 }); }
    }
    for (const lot of lots) {
      const k = rng();
      if (pattern === "court" && lot === lots[0]) { P.lots.push(lot); continue; } // an open yard or car park
      if (tier !== "core" && k < 0.12) { P.lots.push(lot); continue; }
      const m = 1 + rng() * 2.5, w = lot.x1 - lot.x0 - 2 * m, dd = lot.z1 - lot.z0 - 2 * m;
      const bx = (lot.x0 + lot.x1) / 2, bz = (lot.z0 + lot.z1) / 2;
      let h, type, style;
      if (tier === "core") { h = pattern === "tower" ? 62 + rng() * 108 : 34 + rng() * 44; type = "office"; style = 0; }
      else if (tier === "mid") { h = 16 + rng() * 44; type = rng() < 0.45 ? "shop" : "apartment"; style = type === "shop" ? 3 : 1; }
      else { h = 6 + rng() * 16; type = rng() < 0.3 ? "warehouse" : rng() < 0.5 ? "shop" : "apartment"; style = type === "warehouse" ? 2 : type === "shop" ? 3 : 1; }
      addBuilding(P, rng, { x: bx, z: bz, w, d: dd, h, type, style, y: 0, lot, blk: r });
    }
  }
  return finish(P, rng);
}

// A tower gets setbacks; every building keeps its footprint in `lot` so shop fronts know which sides face a street.
function addBuilding(P, rng, b) {
  const pal = PALETTE[b.type], colour = pal[Math.floor(rng() * pal.length)], fl = b.type === "warehouse" ? 5.5 : b.type === "office" ? 3.8 : 3.3;
  const base = { ...b, colour, fl, bay: b.type === "office" ? 2.6 + rng() * 0.8 : b.type === "warehouse" ? 6 : 3 + rng() * 1.2, seed: rng() };
  if (b.h > 85 && b.type === "office") {
    const h1 = b.h * 0.5, h2 = b.h * 0.82;
    P.buildings.push({ ...base, h: h1 });
    P.buildings.push({ ...base, w: b.w * 0.78, d: b.d * 0.78, y: h1, h: h2 - h1, seed: rng() });
    const top = { ...base, w: b.w * 0.5, d: b.d * 0.5, y: h2, h: b.h - h2, seed: rng(), crown: true };
    P.buildings.push(top);
    if (b.h > 120 && P.helipads.length < 8) P.helipads.push({ x: b.x, z: b.z, y: b.h });
    P.roofSpots.push({ x: b.x, z: b.z, y: b.h, hw: top.w / 2, hd: top.d / 2 });
  } else {
    P.buildings.push({ ...base, shops: b.type === "shop" || b.style === 3 });
    if (b.h > 30) P.roofSpots.push({ x: b.x, z: b.z, y: b.h, hw: b.w / 2, hd: b.d / 2 });
  }
}

// A rooftop route block: one flat roof filling the lot. The entry block keeps a 12 m corridor along its south edge for
// the access ramp (on the side the route comes from); the exit block keeps one along its north edge, on the far side,
// for the ramp down. Every roof but the last has a kicker at its downstream edge. rise is the way a ramp climbs.
function genRoute(P, r, route, i, rng) {
  const east = route.dir > 0, first = i === route.i0, last = i === route.i0 + route.n - 1;
  const entry = east ? first : last, exit = east ? last : first, h = route.h, run = Math.round(h * 3.4), cw = 12;
  let rt = P.routes.find((q) => q.name === route.name);
  if (!rt) { rt = { name: route.name, h, dir: route.dir, roofs: [], ramps: [], kickers: [] }; P.routes.push(rt); }
  const colour = PALETTE.shop[Math.floor(rng() * PALETTE.shop.length)];
  rt.roofs.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, entry, exit });
  const boxes = [];
  if (entry) {
    const x0 = east ? r.x0 : r.x1 - run, x1 = east ? r.x0 + run : r.x1;
    rt.ramps.push({ x: (x0 + x1) / 2, z: r.z1 - cw / 2, len: run, w: cw - 1, h, rise: east ? "e" : "w" });
    boxes.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 - cw }, east ? { x0: x1, x1: r.x1, z0: r.z1 - cw, z1: r.z1 } : { x0: r.x0, x1: x0, z0: r.z1 - cw, z1: r.z1 });
  } else if (exit) {
    const x0 = east ? r.x1 - run : r.x0, x1 = east ? r.x1 : r.x0 + run;
    rt.ramps.push({ x: (x0 + x1) / 2, z: r.z0 + cw / 2, len: run, w: cw - 1, h, rise: east ? "w" : "e" });
    boxes.push({ x0: r.x0, x1: r.x1, z0: r.z0 + cw, z1: r.z1 }, east ? { x0: r.x0, x1: x0, z0: r.z0, z1: r.z0 + cw } : { x0: x1, x1: r.x1, z0: r.z0, z1: r.z0 + cw });
  } else boxes.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 });
  for (const q of boxes) {
    if (q.x1 - q.x0 < 1 || q.z1 - q.z0 < 1) continue;
    P.buildings.push({ x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, w: q.x1 - q.x0, d: q.z1 - q.z0, h, y: 0, type: "shop", style: 3, colour, fl: 3.4, bay: 3.4, seed: rng(), shops: true, route: route.name, lot: q, blk: r });
  }
  if (!exit) rt.kickers.push({ x: east ? r.x1 - 8 : r.x0 + 8, z: (r.z0 + r.z1) / 2, w: 10, len: 10, h: 2.2, y: h, rise: east ? "e" : "w" });
  P.power.push({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: h });
}

function finish(P, rng) {
  // Spawns: on the avenue and street centrelines, away from the parked cars at the kerbs.
  for (const [x, z] of [[0, 250], [0, -250], [250, 0], [-250, 0], [300, -250], [-300, -250], [300, 250], [-300, 250], [150, -300], [-150, 300], [150, 300], [-150, -300], [500, 0], [-500, 0], [0, 380], [0, -380]]) P.spawns.push({ x, z, y: 0 });
  P.spawns.push({ x: -285, z: RUNWAY.cz, y: 0, faceX: true, air: true }, { x: 285, z: RUNWAY.cz, y: 0, faceX: true, air: true }); // the runway ends
  P.spawns.push({ x: 372, z: 100, y: 0 }, { x: 428, z: 100, y: 0 }); // the stadium pitch
  P.spawns.push({ x: -60, z: 436, y: 0 }); // the harbour yard
  // Aircraft poses (flight mode): the runway thresholds facing along the strip and the tower helipads.
  P.air.push({ name: "Runway west", x: -270, z: RUNWAY.cz, y: 0, heading: -Math.PI / 2 }, { name: "Runway east", x: 270, z: RUNWAY.cz, y: 0, heading: Math.PI / 2 });
  for (const h of P.helipads) P.air.push({ name: "Helipad", x: h.x, z: h.z, y: h.y, heading: 0 });
  // Horde points (hunt): street junctions, the park, the stadium pitch, the harbour yard, the airfield apron.
  for (let a = -5; a <= 5; a += 1) for (let b = -5; b <= 5; b += 1) {
    const x = a * 100, z = b * 100, p = { x, z };
    if (Math.hypot(x, z) > 560 || (a + b * 2 + 40) % 3 !== 0) continue;
    if (inside(p, ZONES.plaza) || inside(p, ZONES.airfield) || inside(p, ZONES.harbour) || Math.hypot(x - 400, z - 100) < 110) continue;
    P.horde.push({ x, z, y: 0 });
  }
  for (const [x, z] of [[-300, 0], [-250, -60], [-250, 60], [380, 100], [420, 100], [-60, 436], [60, 436], [-120, -470], [100, -470]]) P.horde.push({ x, z, y: 0 });
  // Crates: avenues, the plaza deck, the route roofs (added by genRoute).
  for (const [x, z, y] of [[0, 150, 0], [150, 0, 0], [0, -150, 0], [-150, 0, 0], [300, 150, 0], [-300, -150, 0], [45, 45, PLAZA_H], [-45, -45, PLAZA_H], [0, -440, 0], [380, 100, 0], [-100, 430, 0], [-300, 0, 0]]) P.power.push({ x, z, y });
  // The city tour: a loop through every district.
  for (const [x, z, y] of [[0, -200, 0], [0, -380, 0], [-250, RUNWAY.cz, 0], [250, RUNWAY.cz, 0], [300, -250, 0], [400, 100, 0], [500, 0, 0], [250, 300, 0], [-100, 436, 0], [-300, 300, 0], [-300, 0, 0], [-500, -200, 0], [-150, -150, 0]]) P.cps.push({ x, z, y });
  // Smashable props (barrels and crates in the alleys, signs at junctions).
  for (const a of P.alleys) {
    if (rng() < 0.5) continue;
    const x = (a.x0 + a.x1) / 2, z = (a.z0 + a.z1) / 2;
    P.props.push({ kind: "barrel", x: x + (rng() - 0.5) * 4, z: z + (rng() - 0.5) * 4, y: 0, ry: 0 }, { kind: "crate", x: x + 2, z: z - 2, y: 0, ry: rng() * 3 });
  }
  for (const [x, z] of [[-240, 430], [-200, 450], [-20, 450], [60, 420], [120, 440], [-310, 420]]) P.props.push({ kind: "crate", x, z, y: 0, ry: x }, { kind: "barrel", x: x + 2, z: z + 1, y: 0, ry: 0 });
  return P;
}
