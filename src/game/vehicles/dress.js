// Visual dressing for vehicle meshes (called once from build.js). Never touches part ids, sizes, sockets or the
// parts list: it upgrades materials (object-space triplanar PBR so textures keep real scale on every box), merges the
// static decoration into a few meshes (vehicles were ~60 draw calls each), adds detail (bolted plates, weld seams,
// roof racks, exhaust stacks, mud flaps, mirrors, light bars), real tyres and rims, and hides small detail far away.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbrSet } from "@/game/assets/assets";
import { TRIPLANAR, OBJECT_VARYINGS, OBJECT_VERTEX, patch } from "@/game/render/shaderlib";
import { onFrame } from "@/game/render/frame";

const DETAIL_DIST = 75;

// ------------------------------------------------------------------ materials
const TP_FRAG = (paint) => `
{
  vec3 on = normalize(vSwON);
  vec3 tpw = swTpW(on, 4.0);
  vec3 tp = vSwO * uTpScale;
  vec4 tc = swTp(tTpC, tp, tpw);
  vec3 to = swTp(tTpO, tp, tpw).rgb;
  vec3 col = tc.rgb;
  ${paint ? `
  float l = swLum(col);
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float pm = smoothstep(0.16, 0.34, l) * (1.0 - smoothstep(0.06, 0.16, sat));
  col = mix(col * vec3(0.9, 0.8, 0.72), uTpTint * (0.6 + 0.55 * l), pm);` : "col *= uTpTint;"}
  // dust settles on up-facing panels, grime collects underneath
  vec3 nv = normalize(vSwToView * on);
  float up = dot(nv, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)));
  float n2 = swTp(tTpC, tp * 0.31 + 0.5, tpw).g;
  col = mix(col, vec3(0.52, 0.42, 0.31), smoothstep(0.55, 1.0, up) * (0.25 + 0.35 * n2) * uTpDust);
  col *= mix(1.0, 0.7, smoothstep(-0.2, -0.8, up));
  diffuseColor.rgb *= col;
  swR = to.g; swM = to.b; swAO = mix(1.0, to.r, 0.8);
  swN = swTpN(tTpN, tp, on, tpw, uTpNormal);
}`;

function tpMaterial(setName, o = {}) {
  const S = pbrSet(setName);
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: o.rough ?? 1, metalness: o.metal ?? 1, side: o.side || THREE.FrontSide });
  const tint = new THREE.Color(o.tint || "#ffffff");
  const paint = !!o.paint;
  patch(m, "sw-veh-tp" + (paint ? "p" : ""), (sh) => {
    Object.assign(sh.uniforms, {
      tTpC: { value: S.map }, tTpN: { value: S.normalMap }, tTpO: { value: S.ormMap },
      uTpScale: { value: 1 / (o.metres || S.metres) }, uTpTint: { value: tint }, uTpNormal: { value: o.normal ?? 1 }, uTpDust: { value: o.dust ?? 1 },
    });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + OBJECT_VARYINGS)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n" + OBJECT_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${OBJECT_VARYINGS}uniform sampler2D tTpC, tTpN, tTpO; uniform float uTpScale, uTpNormal, uTpDust; uniform vec3 uTpTint;
vec3 swN = vec3(0.0, 0.0, 1.0); float swR = 1.0, swM = 0.0, swAO = 1.0;\n${TRIPLANAR}`)
      .replace("#include <map_fragment>", TP_FRAG(paint))
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * swR;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = metalness * swM;")
      .replace("#include <normal_fragment_maps>", "normal = normalize(vSwToView * swN);")
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= swAO; reflectedLight.indirectSpecular *= swAO;");
  });
  return m;
}

// The per-vehicle paint keeps its canvas map (damage scorches are drawn on it) and gains triplanar chip normals,
// roughness from the chipped-paint ORM, dust on top and grime underneath.
function upgradePaint(mat) {
  const S = pbrSet("painted_metal_chipped");
  mat.bumpMap = null; mat.roughness = 1; mat.metalness = 0.45;
  patch(mat, "sw-veh-paint", (sh) => {
    Object.assign(sh.uniforms, { tTpN: { value: S.normalMap }, tTpO: { value: S.ormMap }, tTpC: { value: S.map } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + OBJECT_VARYINGS)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n" + OBJECT_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${OBJECT_VARYINGS}uniform sampler2D tTpC, tTpN, tTpO;\nvec3 swN = vec3(0.0, 0.0, 1.0); float swR = 1.0;\n${TRIPLANAR}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 on = normalize(vSwON);
  vec3 tpw = swTpW(on, 4.0);
  vec3 tp = vSwO / 1.5;
  vec3 to = swTp(tTpO, tp, tpw).rgb;
  float chip = 1.0 - smoothstep(0.2, 0.45, swLum(swTp(tTpC, tp, tpw).rgb));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.42, 0.33), chip * 0.55);
  vec3 nv = normalize(vSwToView * on);
  float up = dot(nv, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)));
  float n2 = swTp(tTpC, tp * 0.37 + 0.2, tpw).g;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.45, 0.33), smoothstep(0.55, 1.0, up) * (0.18 + 0.3 * n2));
  diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(-0.2, -0.8, up));
  swR = mix(0.42, 0.95, to.g);
  swN = swTpN(tTpN, tp, on, tpw, 0.8);
}`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * swR;")
      .replace("#include <normal_fragment_maps>", "normal = normalize(vSwToView * swN);");
  });
  mat.needsUpdate = true;
}

// Tyre tread (normal map) and sidewall detail, generated once.
function treadNormal() {
  const W = 256, H = 64, c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / H; // across the tyre (0..1); tread band in the middle
    const band = v > 0.18 && v < 0.82;
    const lug = ((x + Math.abs(v - 0.5) * 70) % 32) < 17 ? 1 : 0; // chevron blocks
    const groove = Math.abs(v - 0.5) < 0.03 ? 0 : 1;
    h[y * W + x] = band ? lug * groove : 0.3 + 0.1 * Math.sin(x * 0.4);
  }
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = h[y * W + ((x + 1) % W)] - h[y * W + ((x - 1 + W) % W)];
    const dy = h[Math.min(H - 1, y + 1) * W + x] - h[Math.max(0, y - 1) * W + x];
    const nx = -dx * 1.4, ny = dy * 1.4, l = Math.hypot(nx, ny, 1), i = (y * W + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.repeat.set(10, 1);
  return t;
}

let VM = null;
function vehicleMaterials(M) {
  if (VM && VM.M === M) return VM;
  const paints = new Map();
  VM = {
    M,
    rust: tpMaterial("rusty_metal", { metres: 0.9 }),
    dark: tpMaterial("painted_metal_chipped", { paint: true, tint: "#34322e", metres: 1.2, rough: 0.95 }),
    chrome: tpMaterial("painted_metal_chipped", { tint: "#8f8a82", metres: 1.4, rough: 0.5, metal: 1, normal: 0.25, dust: 0.5 }),
    bone: tpMaterial("painted_metal_chipped", { paint: true, tint: "#d6ccb4", metres: 1.2 }),
    wood: tpMaterial("wood_planks_old", { metal: 0, metres: 1.4 }),
    tyre: new THREE.MeshStandardMaterial({ color: "#1e1d1c", roughness: 0.93, metalness: 0, normalMap: treadNormal() }),
    paint2(hex) {
      if (!paints.has(hex)) paints.set(hex, tpMaterial("painted_metal_chipped", { paint: true, tint: hex, metres: 1.3, rough: 0.9 }));
      return paints.get(hex);
    },
  };
  VM.tyre.normalScale.set(1.2, 1.2);
  return VM;
}

// ------------------------------------------------------------------ geometry
const geoCache = new Map();
function tyreGeo(r, w) {
  const k = `t${r}|${w}`;
  if (geoCache.has(k)) return geoCache.get(k);
  const pts = [[0.62, -0.5], [0.84, -0.5], [0.95, -0.46], [1.0, -0.32], [1.0, 0.32], [0.95, 0.46], [0.84, 0.5], [0.62, 0.5]]
    .map(([a, b]) => new THREE.Vector2(a * r, b * w));
  const g = new THREE.LatheGeometry(pts, 28);
  // lathe uv: u runs around the tyre, v across the profile (the tread map's layout)
  g.rotateZ(Math.PI / 2);
  g.computeVertexNormals();
  geoCache.set(k, g);
  return g;
}
function rimGeo(r, w) {
  const k = `r${r}|${w}`;
  if (geoCache.has(k)) return geoCache.get(k);
  const R = r * 0.62, parts = [];
  const barrel = new THREE.CylinderGeometry(R, R, w * 0.92, 20, 1, true); barrel.rotateZ(Math.PI / 2); parts.push(barrel);
  const face = new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.03, 20); face.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) { const f = face.clone(); f.translate(s * w * 0.3, 0, 0); parts.push(f); }
  const hub = new THREE.CylinderGeometry(R * 0.28, R * 0.32, w * 0.75, 10); hub.rotateZ(Math.PI / 2); parts.push(hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (const s of [-1, 1]) {
      const nut = new THREE.CylinderGeometry(R * 0.06, R * 0.06, 0.05, 6); nut.rotateZ(Math.PI / 2);
      nut.translate(s * w * 0.33, Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45); parts.push(nut);
      const hole = new THREE.BoxGeometry(0.02, R * 0.16, R * 0.16);
      hole.translate(s * w * 0.31, Math.cos(a + 0.52) * R * 0.72, Math.sin(a + 0.52) * R * 0.72); parts.push(hole);
    }
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { p.deleteAttribute("uv"); return p; }));
  geoCache.set(k, g);
  return g;
}

// Collects detail boxes/tubes per (parent, material) and merges them into one mesh each.
function detailer() {
  const buckets = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const add = (parent, mat, geo, pos, size, rot) => {
    const key = parent.uuid + mat.uuid;
    if (!buckets.has(key)) buckets.set(key, { parent, mat, geos: [] });
    e.set(...(rot || [0, 0, 0])); q.setFromEuler(e);
    m4.compose(p.set(...pos), q, s.set(...size));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(m4);
    for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal") g.deleteAttribute(n);
    buckets.get(key).geos.push(g);
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), BOLT = new THREE.CylinderGeometry(1, 1, 1, 6);
  return {
    box: (parent, mat, pos, size, rot) => add(parent, mat, BOX, pos, size, rot),
    cyl: (parent, mat, pos, r, len, rot) => add(parent, mat, CYL, pos, [r, len, r], rot),
    bolt: (parent, mat, pos, r, rot) => add(parent, mat, BOLT, pos, [r, r * 0.6, r], rot),
    // a tube between two points
    tube: (parent, mat, a, b, r) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      const g = CYL.clone(); g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), qq, new THREE.Vector3(r, L, r)));
      add(parent, mat, g, [0, 0, 0], [1, 1, 1]);
    },
    flush(out) {
      for (const { parent, mat, geos } of buckets.values()) {
        const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = "dress";
        parent.add(mesh);
        out.push(mesh);
      }
      buckets.clear();
    },
  };
}

// Merge every mesh directly under `group` that is not a gameplay object into one mesh per material.
function mergeChildren(group, keep, out) {
  const by = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh || keep.has(o) || o.material === undefined) continue;
    o.updateMatrix();
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrix);
    for (const n of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
    group.remove(o);
  }
  for (const [mat, geos] of by) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = "deco";
    group.add(mesh);
    if (out) out.push(mesh);
  }
}

// ------------------------------------------------------------------ shell detail
// Welded scrap on the Kenney shell: a tube rail along a chopped roof line, patch plates riveted over the flanks and
// sills, weld beads where they meet. Everything goes through the detailer, so it merges into the body's existing
// per-material meshes (no extra draw calls).
function shellDetail(mesh, D, V, M) {
  const { body, shell, chassis: C } = mesh;
  const S = shell.S, cfg = S.cfg, bb = S.geometry.boundingBox;
  const probe = S.probe, V3 = THREE.Vector3;
  const len = bb.max.z - bb.min.z;
  // deterministic per chassis: the same car always has the same patches
  let seed = 0;
  for (const ch of cfg.model) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const side = (s, y, z) => probe(new V3(s * 6, y, z), new V3(-s, 0, 0), 8);
  // chopped roof: a welded tube rail along the cut on both sides, cross bars front and back
  if (cfg.chop !== undefined) {
    const y = cfg.yBase + cfg.chop * cfg.sy - 0.06, pts = { "-1": [], 1: [] };
    for (let i = 0; i <= 9; i++) {
      const z = bb.min.z + 0.3 + (i / 9) * (len - 0.6);
      for (const s of [-1, 1]) { const h = side(s, y, z); if (h) pts[s].push([h.p.x + s * 0.01, y + 0.03, z]); }
    }
    for (const s of [-1, 1]) for (let i = 0; i + 1 < pts[s].length; i++) D.tube(body, V.dark, pts[s][i], pts[s][i + 1], 0.032);
    for (const k of [0, -1]) {
      const a = pts[-1].at(k), b = pts[1].at(k);
      if (a && b) D.tube(body, V.dark, a, b, 0.032);
    }
  }
  // patch plates on the flanks, riveted, with a weld bead along the top edge
  const nPatch = Math.max(2, Math.round(len / 1.6));
  for (const s of [-1, 1]) for (let i = 0; i < nPatch; i++) {
    const z = bb.min.z + len * (0.15 + 0.7 * ((i + 0.3 + rnd() * 0.4) / nPatch));
    const y = cfg.yBase + cfg.sy * (0.35 + rnd() * 0.25);
    const h = side(s, y, z);
    if (!h || Math.abs(h.n.x) < 0.6) continue;
    const w = 0.35 + rnd() * 0.45, ht = 0.18 + rnd() * 0.2, x = h.p.x + s * 0.016, tilt = (rnd() - 0.5) * 0.12;
    const mat = rnd() < 0.55 ? V.rust : V.dark;
    D.box(body, mat, [x, y, z], [0.022, ht, w], [tilt, 0, 0]);
    for (const dz of [-1, 1]) for (const dy of [-1, 1]) D.bolt(body, V.chrome, [x + s * 0.012, y + dy * ht * 0.36, z + dz * w * 0.42], 0.02, [0, 0, Math.PI / 2]);
    D.box(body, V.dark, [x - s * 0.004, y + ht / 2, z], [0.03, 0.016, w * 0.96], [tilt, 0, 0]);
  }
  // sill guards: a rusty bar along each rocker, welded on with a bead
  const sy = cfg.yBase + cfg.sy * 0.33;
  for (const s of [-1, 1]) {
    const h = side(s, sy, (bb.min.z + bb.max.z) / 2);
    if (!h) continue;
    const L = len * (cfg.cut !== undefined ? 0.35 : 0.42);
    D.box(body, V.rust, [h.p.x + s * 0.03, sy, (bb.min.z + bb.max.z) / 2], [0.06, 0.09, L]);
    D.box(body, V.dark, [h.p.x + s * 0.003, sy + 0.05, (bb.min.z + bb.max.z) / 2], [0.025, 0.018, L]);
  }
  // the tanker's cab is cut open at the back: weld a sheet over it
  if (cfg.cut !== undefined) {
    const z = cfg.cutTo + 0.02, top = probe(new V3(0, 6, z - 0.15), new V3(0, -1, 0), 10);
    const y1 = top ? top.p.y : cfg.yBase + cfg.sy * 1.8, y0 = cfg.yBase + cfg.sy * 0.3;
    D.box(body, V.rust, [0, (y0 + y1) / 2, z], [bb.max.x * 1.9, y1 - y0, 0.04]);
    for (const x of [-0.6, 0, 0.6]) D.box(body, V.dark, [x * bb.max.x, (y0 + y1) / 2, z + 0.025], [0.02, y1 - y0, 0.015]);
  }
  void M;
}

// ------------------------------------------------------------------ dress
export function dressVehicle(mesh, M) {
  try {
    dress(mesh, M);
  } catch (err) {
    console.warn("[dress] skipped", err?.message || err);
  }
  return mesh;
}

function dress(mesh, M) {
  const { root, body, parts, wheels, mounts, flames, paintMat, chassis: C, shell } = mesh;
  const V = vehicleMaterials(M);
  upgradePaint(paintMat);

  // 1. material swap (shared library -> object-space triplanar vehicle variants)
  const swap = new Map([[M.rust, V.rust], [M.dark, V.dark], [M.chrome, V.chrome], [M.bone, V.bone], [M.wood, V.wood], [M.rubber, V.tyre]]);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (swap.has(o.material)) o.material = swap.get(o.material);
    else if (o.material !== paintMat && o.material.userData && o.material.userData.paintHex) o.material = V.paint2(o.material.userData.paintHex);
  });

  // 2. merge static decoration (cage tubes, rivets, deco boxes) into a few meshes
  const detail = [];
  const keep = new Set(parts.map((p) => p.obj));
  for (const w of wheels) keep.add(w.pivot);
  for (const m of mounts) keep.add(m.model.root);
  for (const f of flames) keep.add(f);
  if (shell) keep.add(shell.mesh);
  mergeChildren(body, keep, detail);
  for (const p of parts) if (p.obj.isGroup && (p.kind === "cage" || p.kind === "armour")) mergeChildren(p.obj, new Set(), null);

  // 3. tyres and rims
  for (const w of wheels) {
    const { r, w: wd } = w.def;
    const [tyre, rim] = w.spin.children;
    if (tyre && tyre.isMesh) { tyre.geometry = tyreGeo(r, wd); tyre.material = V.tyre; }
    if (rim && rim.isMesh) { rim.geometry = rimGeo(r, wd); rim.material = w.def.drive ? V.dark : V.chrome; }
  }

  // 4. added detail, merged per (parent, material)
  const D = detailer();
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));

  const plateOn = (part, side) => {
    const sz = (part.vis || part.spec).size, o = part.obj;
    const [w, h, d] = sz;
    if (part.spec.shape === "cage") return;
    if (side === "x") {
      const x = (w / 2 + 0.012) * Math.sign(o.position.x || 1);
      D.box(o, V.rust, [x, -h * 0.05, d * 0.05], [0.02, h * 0.62, d * 0.55]);
      for (const zz of [-0.24, 0.24]) for (const yy of [-0.22, 0.13]) D.bolt(o, V.chrome, [x + 0.012 * Math.sign(x), yy * h, d * 0.05 + zz * d], 0.022, [0, 0, Math.PI / 2]);
      D.box(o, V.dark, [x * 1.001, h * 0.28, 0], [0.016, 0.014, d * 0.92]); // weld seam
    } else {
      D.box(o, V.rust, [w * 0.18, h / 2 + 0.012, -d * 0.12], [w * 0.36, 0.02, d * 0.42], [0, 0.12, 0]);
      for (const xx of [-0.12, 0.12]) for (const zz of [-0.15, 0.15]) D.bolt(o, V.chrome, [w * 0.18 + xx * w * 0.7, h / 2 + 0.026, -d * 0.12 + zz * d], 0.024);
      D.box(o, V.dark, [-w * 0.28, h / 2 + 0.006, 0], [0.018, 0.012, d * 0.95]);
      D.box(o, V.dark, [0, h / 2 + 0.006, d * 0.38], [w * 0.92, 0.012, 0.018]);
    }
  };
  for (const id of ["doorL", "doorR", "door"]) if (byId[id]) plateOn(byId[id], "x");
  if (byId.hood) plateOn(byId.hood, "y");

  // roof rack with a jerrycan and spare wheel on cars that have a roof
  const roof = byId.roof;
  if (roof && C.hit.half[2] < 3) {
    const [w, h, d] = (roof.vis || roof.spec).size, y = h / 2;
    for (const x of [-w * 0.42, w * 0.42]) {
      D.tube(roof.obj, V.dark, [x, y, -d * 0.45], [x, y + 0.14, -d * 0.38], 0.022);
      D.tube(roof.obj, V.dark, [x, y + 0.14, -d * 0.38], [x, y + 0.14, d * 0.42], 0.022);
      D.tube(roof.obj, V.dark, [x, y + 0.14, d * 0.42], [x, y, d * 0.46], 0.022);
    }
    for (let i = 0; i < 4; i++) { const z = -d * 0.3 + i * d * 0.22; D.tube(roof.obj, V.dark, [-w * 0.42, y + 0.14, z], [w * 0.42, y + 0.14, z], 0.018); }
    D.box(roof.obj, V.paint2("#7a2a1a"), [-w * 0.2, y + 0.3, -d * 0.05], [0.18, 0.3, 0.42]);
    D.box(roof.obj, V.dark, [-w * 0.2, y + 0.47, -d * 0.18], [0.05, 0.05, 0.1]);
    D.box(roof.obj, V.tyre, [w * 0.16, y + 0.2, d * 0.18], [0.5, 0.12, 0.5]);
  }
  // big rigs: stacks and a ladder rail along the top
  if (C.hit.half[2] >= 3 && roof) {
    const [w, h, d] = (roof.vis || roof.spec).size;
    for (let i = 0; i < 8; i++) D.box(roof.obj, V.dark, [0, h / 2 + 0.05, -d / 2 + 0.5 + i * (d - 1) / 7], [w * 0.9, 0.05, 0.06]);
  }

  // exhaust stacks behind the turbo flames (flames sit 0.6 m behind each exhaust point)
  for (const e of C.exhausts) {
    D.cyl(body, V.rust, [e[0], e[1], e[2] - 0.05], 0.075, 0.42, [Math.PI / 2, 0, 0]);
    D.cyl(body, V.dark, [e[0], e[1], e[2] + 0.17], 0.088, 0.08, [Math.PI / 2, 0, 0]);
  }
  // mud flaps behind the rear wheels, mirrors, antenna
  const rearWheels = wheels.filter((w) => w.def.pos[2] > 0);
  const lastZ = Math.max(...rearWheels.map((w) => w.def.pos[2]), 0);
  for (const w of rearWheels) if (w.def.pos[2] === lastZ) {
    const [x, y, z] = w.def.pos;
    D.box(body, V.tyre, [x, y + w.def.r * 0.1, z + w.def.r + 0.08], [w.def.w * 0.9, w.def.r * 1.1, 0.025]);
  }
  const cab = byId.cabin || byId.cab || byId.upper;
  if (cab && cab.spec && !shell) {
    const [w, h, d] = cab.spec.size, [, y0, z0] = cab.spec.pos;
    for (const s of [-1, 1]) {
      D.tube(body, V.dark, [s * w * 0.5, y0, z0 - d * 0.42], [s * (w * 0.5 + 0.16), y0 + 0.05, z0 - d * 0.42], 0.014);
      D.box(body, V.dark, [s * (w * 0.5 + 0.2), y0 + 0.07, z0 - d * 0.42], [0.05, 0.14, 0.18]);
    }
    D.cyl(body, V.dark, [w * 0.4, y0 + h / 2 + 0.6, z0 + d * 0.4], 0.008, 1.2);
    D.box(body, M.cloth, [w * 0.4 + 0.12, y0 + h / 2 + 1.08, z0 + d * 0.4], [0.24, 0.14, 0.004]);
  }
  // open buggies: light bar on the cage
  const cage = byId.cage;
  if (cage) {
    const [w, h, d] = cage.spec.size;
    D.tube(cage.obj, V.dark, [-w * 0.42, h / 2 + 0.06, -d / 2 + 0.3], [w * 0.42, h / 2 + 0.06, -d / 2 + 0.3], 0.03);
    for (const x of [-0.24, 0.24]) {
      D.box(cage.obj, V.dark, [x, h / 2 + 0.14, -d / 2 + 0.3], [0.2, 0.14, 0.1]);
      D.box(cage.obj, M.light, [x, h / 2 + 0.14, -d / 2 + 0.245], [0.15, 0.09, 0.02]);
    }
  }
  if (shell) shellDetail(mesh, D, V, M);
  D.flush(detail);
  // tiny pieces (bolts, lamps, plates, mirrors) never show in a 4k shadow map: skip them in the shadow pass
  const sphere = new THREE.Sphere();
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    sphere.copy(o.geometry.boundingSphere);
    if (sphere.radius < 0.22 || o.name === "dress") o.castShadow = false;
  });

  // 5. far away: hide the small stuff (keeps far vehicles at a handful of draw calls)
  let near = true;
  const wp = new THREE.Vector3();
  const off = onFrame((cam) => {
    if (!root.parent) return;
    root.getWorldPosition(wp);
    const n = cam ? wp.distanceToSquared(cam.position) < DETAIL_DIST * DETAIL_DIST : true;
    if (n === near) return;
    near = n;
    for (const m of detail) m.visible = n;
    for (const w of wheels) { const hub = w.spin.children[2]; if (hub) hub.visible = n; }
  });
  paintMat.addEventListener("dispose", off);
  mesh.dressDetail = detail;
}
