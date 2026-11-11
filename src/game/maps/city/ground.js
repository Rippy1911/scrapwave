// Brasswater's ground in one plane: the street grid, kerbs, lane paint, crossings, the ring road, the runway and the
// verge are worked out per pixel from the position (roads are a regular grid, so a few lines of GLSL replace a
// texture a kilometre wide); the districts (lawn, water, paving, dark tarmac) come from a 1024 px class mask painted
// once on the CPU. No texture files, no road meshes, crisp paint at any distance.
import * as THREE from "three";
import { CITY, ZONES, RUNWAY } from "@/game/maps/city/plan";
import { patch } from "@/game/render/shaderlib";

const MASK = 1024, SPAN = 1408; // the mask covers 1408 m, centred on the city: 1.375 m a pixel
export const CLASS = { grass: 0, water: 1, pave: 2, dark: 3 }; // one class per pixel, later paints win

export function paintMask(plan) {
  const data = new Uint8Array(MASK * MASK * 4), px = (v) => (v + SPAN / 2) / SPAN * MASK;
  const put = (c, i) => { const o = i * 4; data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0; data[o + c] = 255; };
  const rect = (c, x0, x1, z0, z1) => {
    for (let j = Math.max(0, Math.floor(px(z0))); j < Math.min(MASK, Math.ceil(px(z1))); j++) for (let i = Math.max(0, Math.floor(px(x0))); i < Math.min(MASK, Math.ceil(px(x1))); i++) put(c, j * MASK + i);
  };
  const disc = (c, cx, cz, r, r0 = 0) => {
    const x0 = Math.floor(px(cx - r)), x1 = Math.ceil(px(cx + r)), z0 = Math.floor(px(cz - r)), z1 = Math.ceil(px(cz + r));
    for (let j = Math.max(0, z0); j < Math.min(MASK, z1); j++) for (let i = Math.max(0, x0); i < Math.min(MASK, x1); i++) {
      const x = (i + 0.5) / MASK * SPAN - SPAN / 2, z = (j + 0.5) / MASK * SPAN - SPAN / 2, d = Math.hypot(x - cx, z - cz);
      if (d < r && d >= r0) put(c, j * MASK + i);
    }
  };
  const A = ZONES.airfield, H = ZONES.harbour, S = ZONES.stadium;
  for (const l of plan.lots) rect(CLASS.dark, l.x0, l.x1, l.z0, l.z1);
  for (const a of plan.alleys) rect(CLASS.dark, a.x0, a.x1, a.z0, a.z1);
  for (const l of plan.lawns) rect(CLASS.grass, l.x0, l.x1, l.z0, l.z1);
  for (const [x0, x1, z0, z1] of [[-352, -348, -95, 95], [-252, -248, -95, 95], [-395, -205, -52, -48], [-395, -205, 48, 52]]) rect(CLASS.pave, x0, x1, z0, z1); // park paths
  disc(CLASS.water, -250, -50, 22); // the park pond
  rect(CLASS.grass, A.x0, A.x1, A.z0, A.z1 - 10); // the airfield's grass; the runway is drawn by the shader on top
  rect(CLASS.pave, -200, 260, -476, -410); // apron
  rect(CLASS.dark, A.x0, A.x1, -496, -482); // taxiway
  for (const cx of [-250, 250]) rect(CLASS.dark, cx - 7, cx + 7, RUNWAY.cz + 20, -482); // runway connectors
  rect(CLASS.pave, H.x0, H.x1, 400, 472); // harbour yard and quay
  rect(CLASS.water, H.x0, H.x1, 472, H.z1);
  for (const [x0, x1] of [[-262, -228], [-132, -98], [-2, 32]]) rect(CLASS.pave, x0, x1, 472, 580); // piers
  disc(CLASS.pave, S.cx, S.cz, S.r); // stadium forecourt
  disc(CLASS.grass, S.cx, S.cz, 62); // the pitch
  const t = new THREE.DataTexture(data, MASK, MASK, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

const FRAG_DECL = `
varying vec2 vCP;
uniform sampler2D uMask;
float swRough = 0.92;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float hwOf(float k) { return mod(k, 3.0) < 0.5 ? 12.0 : 7.0; }
float line(float x, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.1, abs(x)); }
vec3 cityGround(vec2 p) {
  float r = length(p);
  vec2 n = vec2(vn(p * 0.35), vn(p * 1.9 + 7.0));
  vec3 col = vec3(0.21, 0.205, 0.2) * (0.82 + 0.34 * n.x); // block interior: bare concrete under the buildings
  swRough = 0.95;
  vec2 kk = floor(p / ${CITY.G.toFixed(1)} + 0.5), d = abs(p - kk * ${CITY.G.toFixed(1)}), hwv = vec2(hwOf(kk.x), hwOf(kk.y));
  bool inGrid = abs(kk.x) <= 6.0 && abs(kk.y) <= 6.0 && r < 626.0;
  bool onX = d.x < hwv.x, onZ = d.y < hwv.y;
  if (inGrid && !(onX || onZ) && (d.x < hwv.x + 5.0 || d.y < hwv.y + 5.0)) { // pavement
    float tile = max(line(fract(p.x / 1.6) - 0.5, 0.05), line(fract(p.y / 1.6) - 0.5, 0.05));
    col = vec3(0.43, 0.42, 0.40) * (0.88 + 0.22 * n.y) * (1.0 - 0.1 * tile);
  }
  if (inGrid && (onX || onZ)) {
    col = vec3(0.072, 0.072, 0.078) * (0.8 + 0.5 * n.x) * (0.9 + 0.2 * n.y);
    swRough = 0.86;
    float paint = 0.0, yel = 0.0;
    if (onX && !onZ) { // a road running north-south
      float dash = step(fract(p.y / 8.0), 0.55), ave = step(10.0, hwv.x), zs = d.y - hwv.y;
      yel = ave * (line(d.x - 0.25, 0.14));
      paint = max(max(line(d.x - hwv.x + 0.8, 0.15), (1.0 - ave) * line(d.x, 0.16) * dash), ave * line(d.x - 6.0, 0.14) * dash);
      if (zs > 0.8 && zs < 4.4) paint = max(paint, step(0.5, fract(p.x / 1.2)) * step(d.x, hwv.x - 1.0));
    } else if (onZ && !onX) { // a road running east-west
      float dash = step(fract(p.x / 8.0), 0.55), ave = step(10.0, hwv.y), zs = d.x - hwv.x;
      yel = ave * (line(d.y - 0.25, 0.14));
      paint = max(max(line(d.y - hwv.y + 0.8, 0.15), (1.0 - ave) * line(d.y, 0.16) * dash), ave * line(d.y - 6.0, 0.14) * dash);
      if (zs > 0.8 && zs < 4.4) paint = max(paint, step(0.5, fract(p.y / 1.2)) * step(d.y, hwv.y - 1.0));
    }
    col = mix(col, vec3(0.78, 0.77, 0.72), paint * 0.9);
    col = mix(col, vec3(0.86, 0.64, 0.10), yel);
    if (paint + yel > 0.2) swRough = 0.62;
  }
  vec4 m = texture2D(uMask, (p + ${(SPAN / 2).toFixed(1)}) / ${SPAN.toFixed(1)});
  float joint = max(line(fract(p.x / 6.0) - 0.5, 0.08), line(fract(p.y / 6.0) - 0.5, 0.08));
  col = mix(col, vec3(0.10, 0.10, 0.105) * (0.85 + 0.3 * n.x), smoothstep(0.4, 0.6, m.a));
  col = mix(col, vec3(0.46, 0.45, 0.42) * (0.88 + 0.2 * n.y) * (1.0 - 0.12 * joint), smoothstep(0.4, 0.6, m.b));
  col = mix(col, vec3(0.12, 0.25, 0.085) * (0.78 + 0.5 * vn(p * 0.6)) * (0.88 + 0.24 * vn(p * 4.0)), smoothstep(0.4, 0.6, m.r));
  float w = smoothstep(0.4, 0.6, m.g);
  col = mix(col, vec3(0.025, 0.075, 0.1) * (0.8 + 0.4 * vn(p * 0.12 + vec2(3.0))), w);
  swRough = mix(swRough, 0.12, w);
  // the runway: tarmac, edge lines, centre dashes, thresholds
  vec2 q = p - vec2(${RUNWAY.cx.toFixed(1)}, ${RUNWAY.cz.toFixed(1)});
  if (abs(q.x) < ${RUNWAY.hl.toFixed(1)} && abs(q.y) < ${RUNWAY.hw.toFixed(1)}) {
    col = vec3(0.085) * (0.85 + 0.3 * n.x);
    float ax = abs(q.x), ay = abs(q.y);
    float pr = max(line(ay - 18.8, 0.3), line(q.y, 0.45) * step(fract(q.x / 36.0), 0.55));
    pr = max(pr, step(${(RUNWAY.hl - 24).toFixed(1)}, ax) * step(ax, ${(RUNWAY.hl - 8).toFixed(1)}) * step(2.5, ay) * step(ay, 17.5) * step(0.5, fract(q.y / 2.4)));
    pr = max(pr, step(190.0, ax) * step(ax, 202.0) * step(ay, 9.0) * step(5.0, ay));
    col = mix(col, vec3(0.84), pr);
    swRough = 0.7;
  }
  // the ring road and the verge outside it
  if (r >= ${CITY.RING0.toFixed(1)} && r < ${CITY.RING1.toFixed(1)}) {
    float rr = r - ${((CITY.RING0 + CITY.RING1) / 2).toFixed(1)}, ang = atan(p.y, p.x), dash = step(fract(ang * 637.0 / 9.0), 0.55);
    col = vec3(0.07, 0.07, 0.076) * (0.8 + 0.5 * n.x);
    float pr = max(line(abs(rr) - 14.1, 0.18), line(abs(rr) - 7.5, 0.14) * dash);
    col = mix(col, vec3(0.78, 0.77, 0.72), pr * 0.9);
    col = mix(col, vec3(0.86, 0.64, 0.10), line(abs(rr) - 0.25, 0.14));
    swRough = 0.84;
  } else if (r >= ${CITY.RING1.toFixed(1)}) {
    col = vec3(0.32, 0.29, 0.25) * (0.75 + 0.5 * n.x) * (0.9 + 0.2 * n.y);
    swRough = 1.0;
  }
  return col;
}
`;

export function createGroundMaterial(mask) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  patch(m, "city-ground-1", (sh) => {
    sh.uniforms.uMask = { value: mask };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vCP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvCP = position.xz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + FRAG_DECL)
      .replace("#include <map_fragment>", `if (length(vCP) > ${(CITY.R + 6).toFixed(1)}) discard;\ndiffuseColor.rgb = cityGround(vCP);`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = swRough;");
  });
  return m;
}

// The plane (1408 m, a disc is not needed: the wall and the verge hide the corners) sitting 3 cm above the deck floor.
export function createGround(mask) {
  const g = new THREE.PlaneGeometry(SPAN, SPAN, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, createGroundMaterial(mask));
  mesh.position.y = 0.03; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = "city-ground";
  return mesh;
}
