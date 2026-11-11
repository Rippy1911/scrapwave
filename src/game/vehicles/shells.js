// Kenney CC0 car bodies (public/assets/models, see CREDITS.md) as the welded base shell of every chassis.
// The model is turned 180 degrees (Kenney faces +z, the game -z), scaled in x and y, and remapped piecewise in z so
// its wheel arches land on the chassis axles while the overhangs squash or stretch to the chassis ends. The physics
// hit box, wheels and part list never change: the shell is pure visuals, and build.js re-seats the breakable parts
// (hood, doors, windows...) onto its surface with the probe below.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { loadModel, pbrSet } from "@/game/assets/assets";
import { CHASSIS } from "@/game/data/vehicles";
import { TRIPLANAR, OBJECT_VARYINGS, OBJECT_VERTEX, patch } from "@/game/render/shaderlib";

// model: GLB name. sx, sy: scale. yBase: chassis y of the model's ground plane. ends: chassis z of the model's
// front and rear ends. chop: drop the greenhouse above this model height (open tubs). cut + cutTo: keep only the
// model in front of model z `cut` (after the turn) and put that cut at chassis z `cutTo` (tanker: the cab).
// hide: body parts the shell replaces. dropDeco: deco materials the shell makes redundant.
export const SHELLS = {
  jackal: { model: "car_hatchback_sports", sx: 0.83, sy: 0.95, yBase: -0.8, ends: [-1.82, 1.62], chop: 1.06, hide: ["frame"] },
  buggy: { model: "car_sedan", sx: 0.83, sy: 0.95, yBase: -0.8, ends: [-1.82, 1.62], chop: 1.12, hide: ["frame"] },
  brawler: { model: "car_sports", sx: 1.04, sy: 1.03, yBase: -0.8, ends: [-2.4, 2.32], hide: ["chassis", "cabin"] },
  pickup: { model: "truck_pickup", sx: 1.06, sy: 1.02, yBase: -0.84, ends: [-2.46, 2.42], hide: ["chassis", "cabin"] },
  mammoth: { model: "van", sx: 1.34, sy: 1.72, yBase: -1.15, ends: [-5.25, 4.78], hide: ["lower", "upper"], dropDeco: ["hazard"] },
  tanker: { model: "truck_delivery", sx: 1.3, sy: 1.4, yBase: -1.15, ends: [-6.12], cut: -0.86, cutTo: -2.66, hide: ["cab"], skipNodes: ["door"] },
};

const raw = new Map(); // model -> { geos: [non-indexed], map, axles: { f, r } } (model space, turned)
const fitted = new Map(); // chassis -> { geometry, map, cfg, probe }
let loading = null;

/** Load every shell model once; resolves (never rejects) when they are ready or failed. */
export function preloadShells() {
  if (loading) return loading;
  const names = [...new Set(Object.values(SHELLS).map((c) => c.model))];
  loading = Promise.all(names.map((n) => loadModel(n).then((parts) => { if (parts) raw.set(n, bake(parts)); }).catch(() => {}))).then(() => raw.size);
  return loading;
}

function bake(parts) {
  const geos = [], wheels = [];
  let map = null;
  for (const p of parts) {
    const leaf = p.name.split("/")[0].toLowerCase();
    if (leaf.includes("wheel")) {
      p.geometry.computeBoundingBox();
      wheels.push(p.geometry.boundingBox.getCenter(new THREE.Vector3()));
      continue;
    }
    if (!map && p.material && p.material.map) map = p.material.map;
    const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.userData.node = leaf;
    // turn 180 degrees about y: (x, z) -> (-x, -z)
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
    geos.push(g);
  }
  // axles in turned space: the front axle has the most negative z
  const zs = wheels.map((c) => -c.z);
  return { geos, map, axles: { f: Math.min(...zs), r: Math.max(...zs) } };
}

// Piecewise-linear z map through control points [[from, to], ...] (sorted by from), extrapolating the end slopes.
function zMapper(pts) {
  return (z) => {
    let i = 0;
    while (i < pts.length - 2 && z > pts[i + 1][0]) i++;
    const [a0, b0] = pts[i], [a1, b1] = pts[i + 1], k = (b1 - b0) / (a1 - a0);
    return [b0 + (z - a0) * k, k];
  };
}

/** The fitted shell of a chassis, or null while the model is missing (callers keep the procedural body). */
export function shellFor(chassisId) {
  if (fitted.has(chassisId)) return fitted.get(chassisId);
  const cfg = SHELLS[chassisId], R = cfg && raw.get(cfg.model);
  if (!R) return null;
  const C = CHASSIS[chassisId];
  const wz = C.wheels.map((w) => w.pos[2]);
  const fC = Math.min(...wz), rear = wz.filter((z) => z > 0), rC = rear.reduce((a, b) => a + b, 0) / rear.length;
  // extent of the turned model along z (node filter applied)
  const geos = R.geos.filter((g) => !(cfg.skipNodes || []).some((s) => g.userData.node.startsWith(s)));
  let zMin = Infinity, zMax = -Infinity;
  for (const g of geos) { g.computeBoundingBox(); zMin = Math.min(zMin, g.boundingBox.min.z); zMax = Math.max(zMax, g.boundingBox.max.z); }
  const pts = [[zMin, cfg.ends[0]], [R.axles.f, fC]];
  if (cfg.cut !== undefined) pts.push([cfg.cut, cfg.cutTo]);
  else pts.push([R.axles.r, rC], [zMax, cfg.ends[1]]);
  const fz = zMapper(pts);
  const out = [];
  for (const g of geos) {
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    const keep = [];
    for (let t = 0; t < P.count; t += 3) {
      const cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, cz = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
      if (cfg.chop !== undefined && cy > cfg.chop) continue;
      if (cfg.cut !== undefined && cz > cfg.cut) continue;
      keep.push(t);
    }
    const n = keep.length * 3, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const t of keep) for (let v = t; v < t + 3; v++, o++) {
      const [z, k] = fz(P.getZ(v));
      pos[o * 3] = P.getX(v) * cfg.sx; pos[o * 3 + 1] = cfg.yBase + P.getY(v) * cfg.sy; pos[o * 3 + 2] = z;
      // normals of a scaled surface: inverse-transpose of the local scale
      let nx = N.getX(v) / cfg.sx, ny = N.getY(v) / cfg.sy, nz = N.getZ(v) / k;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[o * 3] = nx / l; nor[o * 3 + 1] = ny / l; nor[o * 3 + 2] = nz / l;
      if (UV) { uv[o * 2] = UV.getX(v); uv[o * 2 + 1] = UV.getY(v); }
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    ng.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    ng.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.push(ng);
  }
  const geometry = mergeGeometries(out, false);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const S = { geometry, map: R.map, cfg, probe: makeProbe(geometry), cache: new Map() };
  fitted.set(chassisId, S);
  return S;
}

// Ray probe against the shell (both faces). hit(origin, dir) -> { p, n } with n facing back along the ray.
const probeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function makeProbe(geometry) {
  const mesh = new THREE.Mesh(geometry, probeMat);
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  return (o, d, far = 30) => {
    rc.set(o, d); rc.far = far;
    const h = rc.intersectObject(mesh, false)[0];
    if (!h) return null;
    const n = h.face.normal.clone();
    if (n.dot(d) > 0) n.negate();
    return { p: h.point.clone(), n, dist: h.distance };
  };
}

// ------------------------------------------------------------------ material
// The Kenney palette atlas repainted for the wasteland: saturated cells take the vehicle paint, neutral ones
// (glass, trim, lamps) stay; object-space triplanar rust patches, paint chips, rotten sills, dust on top, grime
// below. Per vehicle: scorch marks (uScorch), dents (uDent, vertex push), and a burnt-out wreck (uBurnt).
export function shellMaterial(S, { paint = "#c7762e", rust = 0.45 } = {}) {
  const R = pbrSet("rusty_metal"), P = pbrSet("painted_metal_chipped");
  const open = S.cfg.chop !== undefined || S.cfg.cut !== undefined;
  const m = new THREE.MeshStandardMaterial({ map: S.map, roughness: 1, metalness: 1, side: open ? THREE.DoubleSide : THREE.FrontSide });
  const U = {
    tRC: { value: R.map }, tRO: { value: R.ormMap }, tPC: { value: P.map }, tPN: { value: P.normalMap },
    uTint: { value: new THREE.Color(paint) }, uRust: { value: rust }, uBurnt: { value: 0 },
    uLow: { value: S.cfg.yBase + 0.3 * S.cfg.sy },
    uScorch: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uDent: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
    uDentN: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
  };
  patch(m, "sw-shell", (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${OBJECT_VARYINGS}uniform vec4 uDent[6]; uniform vec3 uDentN[6];`)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n" + OBJECT_VERTEX)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
for (int i = 0; i < 6; i++) {
  float r = uDent[i].w;
  if (r > 0.0) { float f = 1.0 - smoothstep(0.0, r, distance(position, uDent[i].xyz)); transformed += uDentN[i] * f * f; }
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${OBJECT_VARYINGS}uniform sampler2D tRC, tRO, tPC, tPN; uniform vec3 uTint; uniform float uRust, uBurnt, uLow; uniform vec4 uScorch[8];
vec3 swN = vec3(0.0, 0.0, 1.0); float swR = 1.0, swM = 0.0;\n${TRIPLANAR}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 on = normalize(vSwON);
  vec3 tpw = swTpW(on, 4.0);
  vec3 tp = vSwO;
  vec3 c = diffuseColor.rgb;
  float l = swLum(c);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float pm = smoothstep(0.05, 0.16, sat) * step(l, 0.85);
  c = mix(c * vec3(0.8, 0.76, 0.72), uTint * (0.5 + 0.8 * l), pm);
  float chip = 1.0 - smoothstep(0.2, 0.45, swLum(swTp(tPC, tp / 1.5, tpw).rgb));
  vec3 rc = swTp(tRC, tp / 0.9, tpw).rgb;
  vec3 ro = swTp(tRO, tp / 0.9, tpw).rgb;
  float n = swTp(tPC, tp * 0.21 + 0.37, tpw).g;
  float rm = smoothstep(0.66 - uRust * 0.3, 0.8 - uRust * 0.22, n);
  rm = max(rm, smoothstep(uLow + 0.5, uLow, vSwO.y) * 0.7 * uRust);
  rm = max(rm, chip * (0.25 + 0.5 * uRust));
  c = mix(c, rc * 0.92, rm * 0.9);
  vec3 nv = normalize(vSwToView * on);
  float up = dot(nv, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)));
  c = mix(c, vec3(0.55, 0.45, 0.33), smoothstep(0.5, 1.0, up) * (0.16 + 0.32 * n));
  c *= mix(1.0, 0.68, smoothstep(-0.2, -0.8, up));
  float sc = 0.0;
  for (int i = 0; i < 8; i++) { vec4 s = uScorch[i]; if (s.w > 0.0) sc += 1.0 - smoothstep(s.w * 0.25, s.w, distance(vSwO, s.xyz)); }
  sc = clamp(sc, 0.0, 1.0) * (0.55 + 0.45 * n);
  c = mix(c, vec3(0.03, 0.026, 0.022), sc * 0.92);
  c = mix(c, mix(vec3(0.028, 0.024, 0.02), rc * 0.4, smoothstep(0.35, 0.8, n)), uBurnt);
  if (!gl_FrontFacing) c *= 0.4;
  diffuseColor.rgb = c;
  swR = mix(mix(0.38, 0.6, chip), ro.g, rm);
  swR = mix(swR, 0.95, max(sc, uBurnt));
  swM = mix(0.45 * pm + 0.15, ro.b * 0.6, rm) * (1.0 - 0.7 * uBurnt);
  swN = swTpN(tPN, tp / 1.5, on, tpw, 0.55);
}`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swR;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = swM;")
      .replace("#include <normal_fragment_maps>", "normal = normalize(vSwToView * swN) * faceDirection;");
  });
  let si = 0, di = 0;
  return {
    material: m, U,
    // a scorch mark at a local point (radius in metres)
    scorch(p, r = 0.35) { U.uScorch.value[si].set(p.x, p.y, p.z, r); si = (si + 1) % 8; },
    // push the panel in around a local point; depth along the inward direction from the body centre
    dent(p, r = 0.45, depth = 0.08) {
      const c = S.geometry.boundingBox.getCenter(new THREE.Vector3());
      const dir = new THREE.Vector3(p.x - c.x, (p.y - c.y) * 0.5, p.z - c.z).normalize().multiplyScalar(-depth);
      U.uDent.value[di].set(p.x, p.y, p.z, r); U.uDentN.value[di].copy(dir); di = (di + 1) % 6;
    },
  };
}
