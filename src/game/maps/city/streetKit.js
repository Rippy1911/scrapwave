// The street furniture, all instanced per chunk: lamp posts, parked cars, trees, chain-link fences, shop-front glass.
// Lamps, fences and panes are breakable (maps/city/smash.js); parked cars and trees are solid. Where a thing stands
// is decided here from the plan and the road grid, with a fixed seed, so the city is the same on every client.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CITY, ZONES, CAR_COLOURS, hw } from "@/game/maps/city/plan";
import { compose } from "@/game/maps/city/chunks";

const G = CITY.G, TAU = Math.PI * 2;
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const hex = (c) => new THREE.Color(c);
const near = (c) => { const k = Math.round(c / G); return { k, d: Math.abs(c - k * G) }; };

// Is a point somewhere street furniture should not go (inside the plaza and its tunnels, a zone, the ring)?
export function blocked(x, z, pad = 0) {
  const r = Math.hypot(x, z);
  if (r > CITY.RING0 - 6 - pad) return true;
  if (Math.abs(x) < 104 && Math.abs(z) < 104) return true;
  const A = ZONES.airfield, H = ZONES.harbour, S = ZONES.stadium;
  if (x > A.x0 - 8 && x < A.x1 + 8 && z > A.z0 && z < A.z1 + 8) return true;
  if (x > H.x0 - 8 && x < H.x1 + 8 && z > H.z0 - 8) return true;
  return Math.hypot(x - S.cx, z - S.cz) < S.r + 12;
}
// Where a point on a road line, `along` the line, sits relative to the crossing roads: true in a junction's mouth.
const inJunction = (along, margin) => { const n = near(along); return n.d < hw(n.k) + margin; };

// Walks every road (both axes) at a fixed step and calls fn(x, z, side (+1|-1), axis, k, step index).
function eachRoadSpot(step, offset, fn) {
  for (const axis of ["x", "z"]) for (let k = -CITY.LINES; k <= CITY.LINES; k++) {
    const line = k * G;
    let i = 0;
    for (let a = -620 + (k * 13 + 7) % step; a <= 620; a += step, i++) {
      if (inJunction(a, 7)) continue;
      const side = (i + k) % 2 ? 1 : -1;
      const x = axis === "x" ? line : a, z = axis === "x" ? a : line;
      fn(x, z, side, axis, k, i, offset);
    }
  }
}

export function addStreetKit(C, plan, F, mats, smash, rng) {
  const out = { lamps: 0, cars: 0, trees: 0, fences: 0, panes: 0 };
  // ---- kinds
  const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.14, 8.4, 6).translate(0, 4.2, 0), box(2.3, 0.14, 0.14, 1.15, 8.3)]);
  C.kind("lampPole", { geometry: poleGeo, material: mats.pole, range: 330 });
  C.kind("lampHead", { geometry: box(1.0, 0.16, 0.46, 0, 0), material: mats.lamp, range: 330 });
  C.kind("carBody", { geometry: mergeGeometries([box(1.9, 0.7, 4.3, 0, 0.3), box(1.7, 0.4, 3.6, 0, 0.12)]), material: mats.carBody, range: 300, shadow: true });
  C.kind("carCab", { geometry: box(1.62, 0.62, 2.1, 0, 1.0, -0.2), material: mats.glass, range: 300 });
  C.kind("trunk", { geometry: new THREE.CylinderGeometry(0.2, 0.3, 3.4, 6).translate(0, 1.7, 0), material: mats.trunk, range: 420 });
  C.kind("crown", { geometry: new THREE.IcosahedronGeometry(1, 1).translate(0, 4.6, 0), material: mats.leaf, range: 420, shadow: true });
  C.kind("fence", { geometry: box(1, 1, 1, 0, 0), material: mats.fence, range: 260 });
  C.kind("pane", { geometry: new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), material: mats.pane, range: 340 });

  // ---- lamp posts (breakable), every 40 m along every road, on the pavement, alternating sides
  eachRoadSpot(40, 0, (x, z, side, axis, k) => {
    const lat = hw(k) + 2.3, px = axis === "x" ? x + side * lat : x, pz = axis === "x" ? z : z + side * lat;
    if (blocked(px, pz)) return;
    lamp(px, pz, axis === "x" ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2));
  });
  // and round the ring road: inside and outside kerb, every ~42 m
  for (let a = 0, i = 0; a < TAU; a += 42 / 637, i++) {
    const r = i % 2 ? CITY.RING0 - 1.6 : CITY.RING1 + 1.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    lamp(x, z, -a + (i % 2 ? 0 : Math.PI));
  }
  function lamp(x, z, yaw) {
    const a = C.add("lampPole", x, z, compose(x, 0, z, yaw, 1, 1, 1)), b = C.add("lampHead", x, z, compose(x + Math.cos(yaw) * 2.0, 8.15, z - Math.sin(yaw) * 2.0, yaw, 1, 1, 1));
    const link = (h, k) => ({ chunk: h.chunk, kind: k, idx: h.idx, x: h === b ? x + Math.cos(yaw) * 2.0 : x, y: h === b ? 8.15 : 0, z: h === b ? z - Math.sin(yaw) * 2.0 : z, yaw, sx: 1, sy: 1, sz: 1 });
    smash.add({ type: "lamp", x, y: 4, z, r: 0.5, hx: 0.15, hy: 4, hz: 0.15, links: [link(a, "lampPole"), link(b, "lampHead")] });
    out.lamps++;
  }

  // ---- parked cars (solid), in the kerb lane of the quieter stretches, and in the car parks
  const colour = new THREE.Color();
  const parkCar = (x, z, yaw) => {
    colour.set(CAR_COLOURS[Math.floor(rng() * CAR_COLOURS.length)]);
    C.add("carBody", x, z, compose(x, 0, z, yaw, 1, 1, 1), colour.clone());
    C.add("carCab", x, z, compose(x, 0, z, yaw, 1, 1, 1));
    F.collider(x, 0.8, z, 1.9, 1.6, 4.3, yaw, { tag: "city" });
    out.cars++;
  };
  eachRoadSpot(23, 0, (x, z, side, axis, k) => {
    if (rng() > 0.2) return;
    const lat = hw(k) - 1.7, px = axis === "x" ? x + side * lat : x, pz = axis === "x" ? z : z + side * lat;
    if (blocked(px, pz, 14)) return;
    parkCar(px, pz, axis === "x" ? 0 : Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0));
  });
  for (const l of plan.lots) for (let x = l.x0 + 6; x < l.x1 - 4; x += 3.6) for (let z = l.z0 + 8; z < l.z1 - 6; z += 12) if (rng() < 0.38) parkCar(x, z + (rng() - 0.5) * 1.2, 0);

  // ---- trees (solid trunks): the park, the avenues
  const tree = (x, z, s) => {
    C.add("trunk", x, z, compose(x, 0, z, 0, s, s, s));
    colour.set(["#3f5f2a", "#4d6b2f", "#5f6d2c", "#6c5a2a", "#35552f"][Math.floor(rng() * 5)]);
    C.add("crown", x, z, compose(x, 0, z, rng() * TAU, s * (1.6 + rng() * 0.6), s * (1.4 + rng() * 0.5), s * (1.6 + rng() * 0.6)), colour.clone());
    F.collider(x, 2, z, 0.7, 4, 0.7, 0, { tag: "city" });
    out.trees++;
  };
  for (const l of plan.lawns) for (let x = l.x0 + 8; x < l.x1 - 6; x += 17) for (let z = l.z0 + 8; z < l.z1 - 6; z += 17) {
    const tx = x + (rng() - 0.5) * 9, tz = z + (rng() - 0.5) * 9;
    if (Math.hypot(tx + 250, tz + 50) < 29 || [-350, -250].some((p) => Math.abs(tx - p) < 4) || [-50, 50].some((p) => Math.abs(tz - p) < 4)) continue; // pond and paths
    if (rng() < 0.75) tree(tx, tz, 0.9 + rng() * 0.5);
  }
  eachRoadSpot(30, 0, (x, z, side, axis, k) => {
    if (((k % 3) + 3) % 3 !== 0 || rng() > 0.5) return;
    const lat = hw(k) + 3.9, px = axis === "x" ? x + side * lat : x, pz = axis === "x" ? z : z + side * lat;
    if (!blocked(px, pz)) tree(px, pz, 0.8 + rng() * 0.4);
  });

  // ---- chain-link fences (breakable): the airfield, the harbour yard, some car parks
  const panel = (x, z, yaw, len) => {
    const h = C.add("fence", x, z, compose(x, 0, z, yaw, len, 1.9, 0.07));
    smash.add({ type: "fence", x, y: 0.95, z, r: len * 0.5, hx: len / 2, hy: 0.95, hz: 0.1, yaw, links: [{ chunk: h.chunk, kind: "fence", idx: h.idx, x, y: 0, z, yaw, sx: len, sy: 1.9, sz: 0.07 }] });
    out.fences++;
  };
  const fenceLine = (x0, z0, x1, z1, gaps = [], step = 5) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / step), yaw = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (Math.hypot(x, z) > CITY.RING0 - 8 || gaps.some(([a, b]) => (x1 !== x0 ? x > a && x < b : z > a && z < b))) continue;
      panel(x, z, yaw, len / n);
    }
  };
  fenceLine(-318, -411, 318, -411, [[-62, -28], [118, 152]], 6);
  fenceLine(-318, -596, -318, -411, [], 6); fenceLine(318, -596, 318, -411, [], 6);
  fenceLine(-338, 409, 158, 409, [[-72, -28], [38, 82]]);
  fenceLine(-338, 409, -338, 470); fenceLine(158, 409, 158, 470);
  for (const l of plan.lots) {
    if (rng() < 0.45) continue;
    const mx = (l.x0 + l.x1) / 2, mz = (l.z0 + l.z1) / 2;
    fenceLine(l.x0, l.z0, mx - 6, l.z0); fenceLine(mx + 6, l.z0, l.x1, l.z0);
    fenceLine(l.x0, l.z1, mx - 6, l.z1); fenceLine(mx + 6, l.z1, l.x1, l.z1);
    fenceLine(l.x0, l.z0, l.x0, l.z1); fenceLine(l.x1, l.z0, l.x1, l.z1);
  }

  // ---- shop fronts (breakable glass) on the street faces of the shop and route buildings
  let panes = 0;
  for (const b of plan.buildings) {
    if (!b.shops || !b.blk) continue;
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, B = b.blk, e = 3.5;
    const faces = [];
    if (Math.abs(z1 - B.z1) < e) faces.push({ ax: "x", c: z1 + 0.12, a0: x0, a1: x1, yaw: 0 });
    if (Math.abs(z0 - B.z0) < e) faces.push({ ax: "x", c: z0 - 0.12, a0: x0, a1: x1, yaw: Math.PI });
    if (Math.abs(x1 - B.x1) < e) faces.push({ ax: "z", c: x1 + 0.12, a0: z0, a1: z1, yaw: Math.PI / 2 });
    if (Math.abs(x0 - B.x0) < e) faces.push({ ax: "z", c: x0 - 0.12, a0: z0, a1: z1, yaw: -Math.PI / 2 });
    for (const f of faces) {
      const L = f.a1 - f.a0, n = Math.floor((L - 3) / 5);
      for (let i = 0; i < n; i++) {
        if (rng() < 0.18 || panes > 520) continue;
        const a = f.a0 + 1.5 + (i + 0.5) * ((L - 3) / n), px = f.ax === "x" ? a : f.c, pz = f.ax === "x" ? f.c : a;
        const h = C.add("pane", px, pz, compose(px, 0.4, pz, f.yaw, 3.6, 2.6, 1));
        smash.add({ type: "pane", x: px, y: 1.6, z: pz, r: 1.9, hx: f.ax === "x" ? 1.8 : 0.12, hy: 1.3, hz: f.ax === "x" ? 0.12 : 1.8, yaw: 0, links: [{ chunk: h.chunk, kind: "pane", idx: h.idx, x: px, y: 0.4, z: pz, yaw: f.yaw, sx: 3.6, sy: 2.6, sz: 1 }] });
        out.panes++; panes++;
      }
    }
  }
  return out;
}

// The shared materials of the street kit and the buildings' roof plant. night: the { value } uniform every emissive
// part reads (maps/city/index.js animates it from the sky).
export function createKitMaterials(M, night) {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...o });
  const carBody = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.5, envMapIntensity: 1.2 });
  const fence = std("#9aa0a4", { roughness: 0.6, metalness: 0.7, side: THREE.DoubleSide });
  fence.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vFp;").replace("#include <begin_vertex>", "#include <begin_vertex>\n{ float swL = length(instanceMatrix[0].xyz); vFp = vec3(position.x * swL, position.y * length(instanceMatrix[1].xyz), swL); }");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vFp;").replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\n{ vec2 g = abs(fract(vFp.xy * 2.2) - 0.5); float post = step(vFp.z * 0.5 - abs(vFp.x), 0.09) + step(vFp.y, 0.08) + step(1.82, vFp.y); if (min(g.x, g.y) > 0.07 && post < 0.5) discard; }");
  };
  fence.customProgramCacheKey = () => "city-fence-1";
  const pane = new THREE.MeshStandardMaterial({ color: 0x0c1317, roughness: 0.06, metalness: 0.8, envMapIntensity: 1.8, emissive: new THREE.Color("#ffb865"), emissiveIntensity: 0, side: THREE.DoubleSide });
  pane.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vLit;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLit = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vLit;\nuniform float uNight;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.4) * 2.2 * step(0.45, vLit) * uNight;");
  };
  pane.customProgramCacheKey = () => "city-pane-1";
  return {
    building: null, // made by buildings.js (needs the night uniform)
    roofkit: std("#ffffff", { roughness: 0.85, metalness: 0.3 }),
    pole: std("#2b2d30", { roughness: 0.6, metalness: 0.7 }),
    lamp: M.lamp, redLight: M.redLight,
    carBody, glass: std("#0d1418", { roughness: 0.1, metalness: 0.8, envMapIntensity: 1.6 }),
    trunk: std("#4a3a2a", { roughness: 1, metalness: 0 }), leaf: std("#ffffff", { roughness: 0.95, metalness: 0 }),
    fence, pane,
  };
}
