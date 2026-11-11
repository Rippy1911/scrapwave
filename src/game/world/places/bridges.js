// Highway Bridge (broken span, the big jump), Rail Bridge (truss chokepoint) and the Dry Dam with its spillway.
import { BRIDGES, CANYON } from "@/game/data/places";
import { dressProps } from "@/game/world/places/dressing";

function span(kit, roads, def) {
  const [ax, az] = def.a, [bx, bz] = def.b;
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz);
  const deckY = roads.nearest(ax, az, 3, true).y + 0.06;
  return { F: kit.frame(ax, deckY, az, yaw), L, deckY, yaw, ux: dx / L, uz: dz / L };
}

function pier(kit, F, lz, w, M) {
  const gy = F.groundY(0, lz);
  const h = -gy;
  if (h < 2) return;
  F.box(M.concrete, 0, gy + h / 2 - 1, lz, w, h, 3, 0, { collide: true });
  F.box(M.concrete, 0, -1.6, lz, w + 2, 1.2, 4);
}

export function buildHighwayBridge(kit, roads) {
  const { M } = kit;
  const def = BRIDGES.highway;
  const { F, L } = span(kit, roads, def);
  const W = def.width, s1 = (L - def.gap) / 2, s2 = s1 + def.gap;
  const rails = [];
  const deck = (from, to) => {
    const len = to - from, c = -(from + len / 2);
    for (let s = from + 2.5; s < to - 2; s += 5) for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
      const [wx, wz] = F.toWorld(x, -s);
      rails.push({ model: "guard_rail", x: wx, z: wz, y: F.y + 1.3, ry: F.yaw + Math.PI / 2, ground: false });
    }
    F.box(M.concrete, 0, -0.6, c, W, 1.2, len, 0, { collide: true });
    F.box(M.asphalt, 0, 0.01, c, W - 1.2, 0.02, len);
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) F.box(M.concrete, x, 0.65, c, 0.5, 1.3, len, 0, { collide: true });
    F.box(M.hazard, 0, -1.25, c, W + 0.2, 0.15, len);
  };
  deck(-4, s1);
  deck(s2, L + 4);
  // Tilted slab at the near-side break: the launch ramp.
  F.wedge(0, -(s1 - 9), W - 1.4, 18, 3.2, 0, { curve: 1, baseY: F.y }); // curve matches kit.rampGeo (1.0)
  F.prim(kit.rampGeo, M.concrete, 0, 0, -(s1 - 9), W - 1.4, 3.2, 18);
  F.box(M.hazard, 0, 3.22, -s1 + 0.3, W - 1.4, 0.06, 0.6);
  dressProps(kit, rails);
  // Rebar sticking out of both broken edges
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 1 + i * (W - 2) / 8;
    F.beam(M.rust, [x, 2.6, -s1], [x + (i % 2 ? 0.4 : -0.3), 3.2 + (i % 3) * 0.3, -s1 - 1.6], 0.05);
    F.beam(M.rust, [x, -0.6, -s2], [x + (i % 2 ? -0.3 : 0.4), -0.9 - (i % 3) * 0.4, -s2 + 1.5], 0.05);
  }
  // The collapsed span lies in the canyon as a ramp.
  const fy = F.groundY(0, -(s1 + def.gap / 2));
  F.box(M.concrete, 0, fy + 3, -(s1 + def.gap / 2), W - 2, 1, def.gap + 4, 0, { rx: 0.32 });
  F.wedge(0, -(s1 + def.gap / 2), W - 2, def.gap + 4, 6.5, Math.PI, { curve: 1, baseY: F.y + fy });
  for (const s of [12, s1 - 6, s2 + 6, L - 12]) pier(kit, F, -s, W - 4, M);
  kit.label("Highway Bridge", F.x + (def.b[0] - def.a[0]) / 2, F.y + 12, F.z + (def.b[1] - def.a[1]) / 2);
  return { launch: { s1, L, yaw: F.yaw, x: def.a[0], z: def.a[1], y: F.y } };
}

export function buildRailBridge(kit, roads) {
  const { M } = kit;
  const def = BRIDGES.rail;
  const { F, L } = span(kit, roads, def);
  const W = def.width;
  F.box(M.dark, 0, -0.5, -L / 2, W, 1, L + 6, 0, { collide: true });
  for (let s = 0; s < L; s += 1.2) F.box(M.wood, 0, 0.05, -s, W - 1.6, 0.12, 0.35);
  for (const x of [-0.75, 0.75]) F.box(M.chrome, x, 0.2, -L / 2, 0.12, 0.15, L);
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.2);
    F.box(M.rust, x, 0.7, -L / 2, 0.4, 1.4, L + 2, 0, { collide: true });
    F.box(M.rust, x, 6.5, -L / 2, 0.4, 0.4, L - 8);
    for (let s = 0; s <= L; s += 8) {
      F.beam(M.rust, [x, 0, -s], [x, 6.5, -s], 0.18);
      if (s + 8 <= L) F.beam(M.rust, [x, 0, -s], [x, 6.5, -s - 8], 0.12);
    }
  }
  for (let s = 8; s <= L - 8; s += 16) F.beam(M.rust, [-W / 2, 6.5, -s], [W / 2, 6.5, -s], 0.12);
  for (const s of [L * 0.3, L * 0.7]) pier(kit, F, -s, W, M);
  kit.label("Rail Bridge", F.x + (def.b[0] - def.a[0]) / 2, F.y + 14, F.z + (def.b[1] - def.a[1]) / 2);
}

export function buildDam(kit, roads, place) {
  const { M } = kit;
  const def = BRIDGES.dam;
  const { F, L, ux, uz } = span(kit, roads, def);
  const W = def.width;
  const floorY = F.groundY(0, -L / 2);
  const wallH = -floorY + 1.2;
  F.box(M.concrete, 0, -wallH / 2, -L / 2, 18, wallH, L + 20, 0, { collide: true });
  F.box(M.asphalt, 0, 0.01, -L / 2, W, 0.02, L);
  for (let h = 4; h < wallH; h += 4) F.box(M.dark, 9.05, -h, -L / 2, 0.05, 0.3, L + 18);
  // Downstream side: which local x faces the canyon's flow direction?
  const ci = 2, cn = CANYON.pts[ci + 1], cp = CANYON.pts[ci];
  const fx = cn[0] - cp[0], fz = cn[1] - cp[1];
  const lxw = [Math.cos(F.yaw), -Math.sin(F.yaw)];
  const down = Math.sign(lxw[0] * fx + lxw[1] * fz) || 1;
  // Parapets with a gap for the spillway
  for (const side of [-1, 1]) {
    for (const [a, b] of [[-6, L / 2 - 9], [L / 2 + 9, L + 6]]) {
      if (side !== down && a > 0) continue;
      F.box(M.concrete, side * 8.6, 0.6, -(a + b) / 2, 0.8, 1.2, b - a, 0, { collide: true });
    }
    if (side !== down) F.box(M.concrete, side * 8.6, 0.6, -L / 2, 0.8, 1.2, 18, 0, { collide: true });
  }
  // Spillway ramp down into the canyon
  const sLen = Math.max(40, wallH * 2.4);
  const [cx, cz] = F.toWorld(down * (9 + sLen / 2), -L / 2);
  const syaw = Math.atan2(down * lxw[0], down * lxw[1]);
  const S = kit.frame(cx, F.y + floorY, cz, syaw);
  S.wedge(0, 0, 16, sLen, wallH - 1.2, 0, { curve: 1, baseY: F.y + floorY });
  S.prim(kit.rampGeo, M.concrete, 0, 0, 0, 16, wallH - 1.2, sLen);
  for (const x of [-8.4, 8.4]) S.prim(kit.rampGeo, M.hazard, x, 0, 0, 0.6, wallH - 0.4, sLen);
  // Gate towers on the crest
  for (const s of [10, L - 10]) {
    F.box(M.concrete, -down * 6, 3, -s, 4, 6, 4, 0, { collide: true });
    F.box(M.rust, -down * 6, 6.4, -s, 4.6, 0.6, 4.6);
    F.ball(M.lamp, -down * 6, 7.2, -s, 0.3);
  }
  kit.label(place.name, F.x + ux * L / 2, F.y + 16, F.z + uz * L / 2);
}