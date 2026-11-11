// CC0 asset pack loader (public/assets, manifest index.json): PBR texture sets and GLB models.
// Everything is created synchronously and filled in when the files arrive, so world building never waits:
// textures start as a flat placeholder of their mean colour, models resolve a promise.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const ASSET_BASE = "/assets/";

// Metres covered by one texture repeat (from the manifest) and an approximate mean colour for the placeholder.
export const SETS = {
  sand_ripples: { m: 4, mean: "#b48c63" },
  cracked_mud: { m: 1.5, mean: "#94735a" },
  salt_flat: { m: 4, mean: "#c2b49c" },
  red_rock: { m: 3, mean: "#8e5a3f" },
  gravel_dirt: { m: 4, mean: "#8a7562" },
  asphalt_damaged: { m: 3, mean: "#4a4744" },
  rusty_metal: { m: 1.25, mean: "#6e4630" },
  painted_metal_chipped: { m: 1.5, mean: "#b9b6b0" },
  corrugated_rusty: { m: 2, mean: "#7a5038" },
  concrete_cracked: { m: 2, mean: "#8d8880" },
  wood_planks_old: { m: 2, mean: "#86725c" },
};

let maxAniso = 8;
export const setAssetAnisotropy = (n) => { maxAniso = Math.max(1, n || 1); };

let pending = 0;
const waiters = [];
const settle = () => { if (--pending <= 0) { pending = 0; while (waiters.length) waiters.shift()(); } };
/** Resolves when every asset requested so far has loaded (or failed). */
export const assetsIdle = () => (pending === 0 ? Promise.resolve() : new Promise((r) => waiters.push(r)));
export const assetsPending = () => pending;

const texCache = new Map();
function placeholder(css) {
  const c = document.createElement("canvas"); c.width = c.height = 4;
  const ctx = c.getContext("2d"); ctx.fillStyle = css; ctx.fillRect(0, 0, 4, 4);
  return c;
}

/** A repeating texture that swaps from a flat placeholder to the real image once it loads. */
export function lazyTexture(url, mean, srgb) {
  const key = url + (srgb ? "|s" : "|l");
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.Texture(placeholder(mean));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  t.userData.loaded = false;
  if (typeof Image !== "undefined") {
    pending++;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      t.dispose(); // the GL texture was allocated at placeholder size; reallocate at the real size
      t.image = img; t.anisotropy = maxAniso; t.needsUpdate = true; t.userData.loaded = true;
      settle();
    };
    img.onerror = () => settle();
    img.src = url;
  }
  texCache.set(key, t);
  return t;
}

/** { map, normalMap, ormMap, metres } for one of the PBR sets. Shared: repeat is set once, for the 2 m building-kit
// UVs (custom shaders ignore it). Never clone these: a clone would keep the placeholder upload. */
const setCache = new Map();
export function pbrSet(name) {
  if (setCache.has(name)) return setCache.get(name);
  const S = SETS[name];
  const base = `${ASSET_BASE}textures/${name}/`;
  const set = {
    name, metres: S.m,
    map: lazyTexture(base + "color.jpg", S.mean, true),
    normalMap: lazyTexture(base + "normal.jpg", "rgb(128,128,255)", false),
    ormMap: lazyTexture(base + "orm.jpg", "rgb(255,215,0)", false),
  };
  setCache.set(name, set);
  return set;
}

// ---------------------------------------------------------------- models
const gltf = new GLTFLoader();
const modelCache = new Map();

/** Loads a GLB and bakes it into [{ name, geometry, material }] in model space (metres, bottom-centre origin). */
export function loadModel(name) {
  if (modelCache.has(name)) return modelCache.get(name);
  pending++;
  const p = new Promise((resolve) => {
    gltf.load(`${ASSET_BASE}models/${name}.glb`, (g) => {
      g.scene.updateMatrixWorld(true);
      const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone();
        geo.morphAttributes = {}; // instanced static props: no morph targets (InstancedMesh has no influences)
        geo.applyMatrix4(o.matrixWorld);
        const names = [];
        for (let q = o; q; q = q.parent) if (q.name) names.push(q.name);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"]) if (m[k]) m[k].anisotropy = maxAniso;
        parts.push({ name: names.join("/"), geometry: geo, material: mats[0] });
      });
      settle();
      resolve(parts);
    }, undefined, (err) => { console.warn("[assets] model failed", name, err?.message || err); settle(); resolve(null); });
  });
  modelCache.set(name, p);
  return p;
}

/** Merge model parts that share a material (fewer draw calls). filter(name) drops nodes (e.g. wheels). */
export function mergeParts(parts, filter) {
  const by = new Map();
  for (const p of parts) {
    if (filter && !filter(p.name)) continue;
    const k = p.material.uuid;
    if (!by.has(k)) by.set(k, { material: p.material, geos: [], name: p.name });
    by.get(k).geos.push(p.geometry);
  }
  const out = [];
  for (const { material, geos, name } of by.values()) {
    let g = geos.length === 1 ? geos[0] : null;
    if (!g) {
      const keys = (x) => Object.keys(x.attributes).sort().join(",");
      const k0 = keys(geos[0]);
      const same = geos.every((x) => keys(x) === k0 && !!x.index === !!geos[0].index);
      g = same ? mergeGeometries(geos, false) : null;
      if (!g) { for (const x of geos) out.push({ geometry: x, material, name }); continue; }
    }
    out.push({ geometry: g, material, name });
  }
  return out;
}

/** Bounding box of a part list. */
export function partsBox(parts) {
  const b = new THREE.Box3(), t = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); t.copy(p.geometry.boundingBox); b.union(t); }
  return b;
}

/**
 * Cheap far LOD by vertex clustering: snaps vertices to a grid of `cell` metres, keeps the averaged position and uv,
 * drops collapsed triangles. Silhouette stays, triangle count drops 20-50x.
 */
export function simplifyGeometry(src, cell, uvCell = 0) {
  const g = src.index ? src.toNonIndexed() : src;
  const P = g.attributes.position, UV = g.attributes.uv, NO = g.attributes.normal;
  const ids = new Map(), acc = [], uvs = [], cnt = [], nac = [];
  const vid = new Int32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let k = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
    if (uvCell && UV) k += `|${Math.round(UV.getX(i) / uvCell)},${Math.round(UV.getY(i) / uvCell)}`; // keep uv seams
    let id = ids.get(k);
    if (id === undefined) { id = cnt.length; ids.set(k, id); acc.push(0, 0, 0); uvs.push(0, 0); cnt.push(0); nac.push(0, 0, 0); }
    acc[id * 3] += x; acc[id * 3 + 1] += y; acc[id * 3 + 2] += z;
    if (NO) { nac[id * 3] += NO.getX(i); nac[id * 3 + 1] += NO.getY(i); nac[id * 3 + 2] += NO.getZ(i); }
    if (UV) { uvs[id * 2] += UV.getX(i); uvs[id * 2 + 1] += UV.getY(i); }
    cnt[id]++;
    vid[i] = id;
  }
  const idx = [], seen = new Set();
  for (let i = 0; i < P.count; i += 3) {
    const a = vid[i], b = vid[i + 1], c = vid[i + 2];
    if (a === b || b === c || a === c) continue;
    const s = [a, b, c].sort((u, v) => u - v).join(",");
    if (seen.has(s)) continue;
    seen.add(s);
    idx.push(a, b, c);
  }
  const n = cnt.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = acc[i * 3] / cnt[i]; pos[i * 3 + 1] = acc[i * 3 + 1] / cnt[i]; pos[i * 3 + 2] = acc[i * 3 + 2] / cnt[i];
    uv[i * 2] = uvs[i * 2] / cnt[i]; uv[i * 2 + 1] = uvs[i * 2 + 1] / cnt[i];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (UV) out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  if (NO) {
    // averaged source normals keep the artist's smooth shading (and agree across uv seams)
    const nn = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = nac[i * 3], y = nac[i * 3 + 1], z = nac[i * 3 + 2], l = Math.hypot(x, y, z) || 1;
      nn[i * 3] = x / l; nn[i * 3 + 1] = y / l; nn[i * 3 + 2] = z / l;
    }
    out.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
  } else out.computeVertexNormals();
  return out;
}

export { mergeVertices };
