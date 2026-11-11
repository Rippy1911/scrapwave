// Brasswater's one-off structures as layout pieces (maps/layout.js), so the arenas' own piece builder turns them
// into merged meshes and colliders: the central plaza with the tunnel under it and the Brass Needle on top, the ring
// road flyover, the stadium, the harbour with its cranes and a moored ship, the airfield, the park and the rooftop
// routes' ramps and parapets. Instanced scenery (buildings, lamps, cars) lives in the chunk grid instead.
import { CITY, ZONES, RUNWAY, PLAZA_H } from "@/game/maps/city/plan";

const TAU = Math.PI * 2, RISE = { e: -Math.PI / 2, w: Math.PI / 2, n: 0, s: Math.PI };
// A rotation that turns a box's local x along the direction (dx, dz).
const yawOf = (dx, dz) => Math.atan2(-dz, dx);
const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

export function buildStructures(B, plan) {
  plaza(B); flyover(B); stadium(B); harbour(B); airfield(B); park(B); routes(B, plan);
}

// ---- the plaza: four podiums 8 m up, joined by the roof of a cross-shaped tunnel; a ramp up each side; the Needle
function plaza(B) {
  const H = PLAZA_H, E = 93, W = 12; // podium edge, tunnel half width
  // quadrant [sx, sz], ramp side: NE from the north, SE from the east, SW from the south, NW from the west
  const quads = [[1, -1, "n"], [1, 1, "e"], [-1, 1, "s"], [-1, -1, "w"]], run = 28, rw = 12;
  for (const [sx, sz, side] of quads) {
    const x0 = sx > 0 ? W : -E, x1 = sx > 0 ? E : -W, z0 = sz > 0 ? W : -E, z1 = sz > 0 ? E : -W;
    const box = (a, b, c, d) => { if (b - a > 0.5 && d - c > 0.5) B.solid("concrete", (a + b) / 2, (c + d) / 2, b - a, H, d - c); };
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (side === "n" || side === "s") { // ramp along z at the centre of the outer edge
      const edge = side === "n" ? z0 : z1, inner = side === "n" ? z0 + run : z1 - run, [a, b] = side === "n" ? [z0, z0 + run] : [z1 - run, z1];
      box(x0, x1, side === "n" ? inner : z0, side === "n" ? z1 : inner); // the body beyond the ramp
      box(x0, mx - rw / 2, a, b); box(mx + rw / 2, x1, a, b); // the strip either side of it
      B.ramp(mx, (a + b) / 2, rw, run, H, side === "n" ? Math.PI : 0, { m: "dark" });
      void edge;
    } else {
      const inner = side === "w" ? x0 + run : x1 - run, [a, b] = side === "w" ? [x0, x0 + run] : [x1 - run, x1];
      box(side === "w" ? inner : x0, side === "w" ? x1 : inner, z0, z1);
      box(a, b, z0, mz - rw / 2); box(a, b, mz + rw / 2, z1);
      B.ramp((a + b) / 2, mz, rw, run, H, side === "w" ? -Math.PI / 2 : Math.PI / 2, { m: "dark" });
    }
  }
  B.solid("dark", 0, 0, 2 * W, 2, 2 * E, 0, H - 2); // the tunnel roofs, 6 m over the road
  B.solid("dark", 0, 0, 2 * E, 2, 2 * W, 0, H - 2);
  // tunnel strip lights and mouth lintels
  for (let t = -84; t <= 84; t += 12) { B.deco("light", t, 0, 0.5, 0.2, 5, 0, H - 2.3); B.deco("light", 0, t, 5, 0.2, 0.5, 0, H - 2.3); }
  // the Brass Needle: brass towers on the plaza, a glowing ring at every stage, a beacon on the tip
  const brass = "#b5893a", gold = "#d2ac55";
  B.solid(brass, 0, 0, 26, 38, 26, 0, H);
  B.solid(brass, 0, 0, 18, 70, 18, 0, H + 38);
  B.solid(gold, 0, 0, 11, 70, 11, 0, H + 108);
  for (const [y, rad] of [[H + 38, 17], [H + 108, 14], [H + 150, 9.5]]) B.disc("light", 0, 0, rad, 0.7, y);
  let y = H + 178;
  for (const w of [8, 6, 4.5, 3.3, 2.4, 1.7, 1.1]) { B.deco(gold, 0, 0, w, 12, w, 0, y); y += 12; }
  B.lamp(0, 0, y + 1.5, 3.6, "redLight");
}

// ---- the flyover: the ring road lifted 8 m for 200 m where the east avenue meets it
function flyover(B) {
  const R = (CITY.RING0 + CITY.RING1) / 2, P = (deg) => [Math.cos(deg * Math.PI / 180) * R, Math.sin(deg * Math.PI / 180) * R], H = PLAZA_H;
  const degs = [-9, -3, 3, 9];
  for (let i = 0; i < 3; i++) {
    const [ax, az] = P(degs[i]), [bx, bz] = P(degs[i + 1]), dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), yaw = yawOf(dx, dz);
    B.solid("concrete", (ax + bx) / 2, (az + bz) / 2, len + 3, 1.4, 22, yaw, H - 1.4);
    for (const s of [-1, 1]) { // parapets
      const nx = -dz / len * s * 10.6, nz = dx / len * s * 10.6;
      B.solid("concrete", (ax + bx) / 2 + nx, (az + bz) / 2 + nz, len + 3, 0.95, 0.6, yaw, H);
    }
  }
  for (const d of [-3, 3]) { const [x, z] = P(d); for (const s of [-8, 8]) { const a = d * Math.PI / 180; B.solid("concrete", x + Math.cos(a) * s, z + Math.sin(a) * s, 3, H - 1.4, 3, -a, 0); } }
  for (const [d, dir] of [[-9, -1], [9, 1]]) { // the approach ramps run straight out along the tangent and rise toward the deck
    const [x, z] = P(d), a = d * Math.PI / 180, tx = -Math.sin(a) * dir, tz = Math.cos(a) * dir, run = 62;
    B.ramp(x + tx * run / 2, z + tz * run / 2, 20, run, H, Math.atan2(tx, tz), { m: "concrete" });
  }
}

// ---- the stadium: a terraced bowl round a pitch, four gates, floodlights and two kickers
function stadium(B) {
  const { cx, cz } = ZONES.stadium, gates = [0, Math.PI / 2, Math.PI, Math.PI * 1.5], N = 46;
  const ringAt = (r0, r1, h, y = 0) => {
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * TAU, r = (r0 + r1) / 2;
      if (gates.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.15)) continue;
      B.solid("concrete", cx + Math.sin(a) * r, cz + Math.cos(a) * r, (TAU * r) / N + 0.9, h, r1 - r0, a, y);
    }
  };
  ringAt(64, 72, 5); ringAt(72, 80, 9.5); ringAt(80, 88, 14);
  for (let i = 0; i < 6; i++) { // floodlight masts outside the bowl
    const a = (i / 6) * TAU + 0.5, x = cx + Math.sin(a) * 98, z = cz + Math.cos(a) * 98;
    B.post("dark", x, z, 0.7, 44); B.deco("dark", x, z, 7, 5, 1.2, a, 44); B.lamp(x - Math.sin(a) * 1.2, z - Math.cos(a) * 1.2, 46.5, 3.2, "lamp");
  }
  for (const s of [-1, 1]) B.ramp(cx + s * 30, cz, 12, 16, 3.4, s > 0 ? Math.PI / 2 : -Math.PI / 2, { m: "wood" }); // kickers toward the centre line
  B.solid("dark", cx, cz - 86, 16, 6, 3, 0, 14); // scoreboard on the north terrace
}

// ---- the harbour: container yard, quay lips, three gantry cranes, a moored ship
function harbour(B) {
  const Z = ZONES.harbour, piers = [[-262, -228], [-132, -98], [-2, 32]], pierEnd = 550;
  const lip = (x0, x1, z0, z1) => B.solid("concrete", (x0 + x1) / 2, (z0 + z1) / 2, Math.max(1.2, x1 - x0), 1.2, Math.max(1.2, z1 - z0));
  const edges = [[Z.x0, piers[0][0]], [piers[0][1], piers[1][0]], [piers[1][1], piers[2][0]], [piers[2][1], Z.x1]];
  for (const [a, b] of edges) lip(a, b, 471.4, 472.6);
  for (const [a, b] of piers) { lip(a - 0.6, a + 0.6, 472, pierEnd); lip(b - 0.6, b + 0.6, 472, pierEnd); lip(a, b, pierEnd - 0.6, pierEnd + 0.6); }
  lip(Z.x0 - 0.6, Z.x0 + 0.6, 472, 521); lip(Z.x1 - 0.6, Z.x1 + 0.6, 472, 598);
  for (let a = 75; a < 123; a += 2) { // the ring road's inner kerb closes the basin
    const r = CITY.RING0 - 2.5, a0 = a * Math.PI / 180, a1 = (a + 2) * Math.PI / 180, x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    if (x0 > Z.x1 || x1 < Z.x0) continue;
    B.solid("concrete", (x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) + 0.6, 1.2, 1.2, yawOf(x1 - x0, z1 - z0));
  }
  // containers: stacks in blocks with 12 m lanes between them
  const cols = ["#b23a1f", "#2f7a74", "#d9b23a", "#3f5f6e", "#8c3b55", "#5e6b3a", "#c7762e", "#7d8a80"];
  let n = 0;
  for (const [x0, x1, z0, z1] of [[-326, -276, 418, 462], [-206, -150, 418, 462], [-100, -44, 418, 462], [14, 70, 418, 462], [90, 150, 418, 462]]) {
    for (let x = x0 + 6; x < x1; x += 12.6) for (let z = z0 + 1.3; z < z1; z += 2.6) {
      const h = 1 + Math.floor(hash(x, z) * 3), c = cols[Math.floor(hash(z, x) * cols.length)];
      B.solid(c, x, z, 12.2, 2.6 * h, 2.4, 0, 0); n++;
    }
  }
  B.solid("corrugated", -300, 395, 60, 12, 20); B.solid("corrugated", 120, 395, 56, 11, 20); // warehouses on the avenue side
  for (const x of [-245, -115, 15]) crane(B, x);
  // a ship alongside the middle pier
  const sx = -180, sz = 510;
  B.solid("#6e2a26", sx, sz, 24, 10, 70, 0, 0); B.solid("#1f2a33", sx, sz, 24.4, 3, 70.4, 0, 0);
  B.solid("#d8d2c4", sx, sz + 24, 20, 16, 14, 0, 10); B.solid("#c9c2b2", sx, sz + 24, 12, 7, 10, 0, 26);
  B.post("#b23a1f", sx, sz + 30, 2.6, 9, 26); B.deco("#2a2a2c", sx, sz + 30, 5.4, 1, 5.4, 0, 35);
  for (let i = 0; i < 6; i++) for (const sd of [-5.5, 5.5]) B.solid(cols[(i + (sd > 0 ? 3 : 0)) % cols.length], sx + sd, sz - 22 + i * 7, 5, 2.6, 6, 0, 10);
  B.lamp(sx, sz + 24, 36, 1.2, "redLight");
  void n;
}
function crane(B, x) {
  const Y = "#d8a21a", legH = 36;
  for (const dx of [-9, 9]) for (const z of [458, 472]) B.solid(Y, x + dx, z, 1.8, legH, 1.8);
  for (const dx of [-9, 9]) B.solid(Y, x + dx, 465, 2.4, 2.6, 18, 0, legH);
  B.solid(Y, x, 465, 22, 2.2, 3, 0, legH + 1);
  B.solid(Y, x, 507, 4.2, 3.6, 94, 0, legH + 2.4); // the boom, out over the water
  B.solid("dark", x, 440, 6, 6, 8, 0, legH + 1); // counterweight on the back reach
  B.deco("#2a3a46", x, 470, 5, 4, 6, 0, legH - 3); B.deco("dark", x, 492, 1, 14, 1, 0, legH - 11); // the operator's cab and hoist line
  B.lamp(x, 553, legH + 6.4, 1.2, "redLight");
}

// ---- the airfield: runway lights, four hangars, a control tower, tanks, a windsock, and two launch ramps
function airfield(B) {
  const z = RUNWAY.cz;
  for (let x = -285; x <= 285; x += 30) for (const s of [-1, 1]) B.lamp(x, z + s * 21.5, 0.35, 0.7, "lamp");
  for (let i = 0; i < 4; i++) {
    const hx = -150 + i * 56, hz = -436;
    B.solid("corrugated", hx, hz, 44, 13, 28); B.deco("dark", hx, hz, 45, 2, 29, 0, 13);
    B.deco("dark", hx, hz + 14.1, 30, 10, 0.3); // the door
  }
  B.solid("concrete", 160, -452, 9, 26, 9); B.deco("glass", 160, -452, 15, 5.5, 15, 0, 26); B.deco("dark", 160, -452, 17, 1.2, 17, 0, 31.5); B.lamp(160, -452, 34, 1.6, "redLight");
  for (const x of [-250, -230, -210]) B.post("#cfc7b4", x, -440, 7, 9);
  B.post("dark", 305, -492, 0.15, 9); B.deco("#ff7a1a", 306.5, -492, 3, 0.8, 0.8, 0, 8);
  B.ramp(-326, z, 18, 44, 7.5, Math.PI / 2, { m: "rust", curve: 1.5 }); B.ramp(326, z, 18, 44, 7.5, -Math.PI / 2, { m: "rust", curve: 1.5 });
}

// ---- the park: pond kerb, bandstand, two earth mounds
function park(B) {
  const px = -250, pz = -50;
  B.ring(14, 23.5, (a, x, z, w) => B.solid("rock", px + x, pz + z, w + 0.6, 1.1, 1.4, a), 0, TAU);
  B.solid("wood", -250, 50, 13, 1, 13); for (const [x, z] of [[-255, 45], [-245, 45], [-255, 55], [-245, 55]]) B.post("wood", x, z, 0.3, 5, 1); B.deco("rust", -250, 50, 15, 0.7, 15, 0, 6);
  B.ramp(-350, -75, 9, 14, 2.6, Math.PI, { m: "sand" }); B.ramp(-350, -61, 9, 14, 2.6, 0, { m: "sand" });
}

// ---- the rooftop routes: access and exit ramps, kickers on the roofs, parapets along the sides
function routes(B, plan) {
  const cw = 12;
  for (const rt of plan.routes) {
    const run = Math.round(rt.h * 3.4), east = rt.dir > 0, wall = (x0, x1, z, h) => { if (x1 - x0 > 1) B.solid("concrete", (x0 + x1) / 2, z, x1 - x0, 0.9, 0.7, 0, h); };
    for (const r of rt.ramps) B.ramp(r.x, r.z, r.w, r.len, r.h, RISE[r.rise], { m: "rust" });
    for (const k of rt.kickers) B.ramp(k.x, k.z, k.w, k.len, k.h, RISE[k.rise], { m: "rust", y: k.y });
    for (const roof of rt.roofs) {
      const { x0, x1, z0, z1 } = roof;
      if (roof.exit) { // the north side is the ramp's corridor: a wall beside it, the parapet beyond it
        if (east) { wall(x0, x1 - run, z0 + 0.4, rt.h); wall(x1 - run, x1, z0 + cw, rt.h); } else { wall(x0 + run, x1, z0 + 0.4, rt.h); wall(x0, x0 + run, z0 + cw, rt.h); }
      } else wall(x0, x1, z0 + 0.4, rt.h);
      if (roof.entry) {
        if (east) { wall(x0 + run, x1, z1 - 0.4, rt.h); wall(x0, x0 + run, z1 - cw, rt.h); } else { wall(x0, x1 - run, z1 - 0.4, rt.h); wall(x1 - run, x1, z1 - cw, rt.h); }
      } else wall(x0, x1, z1 - 0.4, rt.h);
    }
  }
}
