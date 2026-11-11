// Hosted asset pack (round 14): creature models and sound samples live on our own server, not in the repo, and are
// fetched cross-site at runtime. The manifest is fetched once (loadPack, called at boot by audio/audio.js); every
// file after that is fetched on first use and kept. Files are served as application/octet-stream, so models go
// through GLTFLoader and sounds come back as raw bytes for AudioContext.decodeAudioData (never an audio tag).
// Everything resolves to null (or an empty list) when the server cannot be reached: callers keep their built
// figures and synthesized sounds.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

export const MANIFEST_URL = "https://uploads.nextsolutions.studio/f/f3e3fc7391aef1540107bedd2d95ef2b6ffd50dbe45b3d4568eb6ace10c13445.json";

const state = { ok: false, version: null, error: null, models: [], sounds: [], engineLoops: 0, loaded: {} };
const modelCache = new Map();
let packP = null;

/** The manifest, fetched once. Resolves to null when it cannot be loaded. */
export function loadPack() {
  if (packP) return packP;
  packP = fetch(MANIFEST_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((m) => {
      Object.assign(state, { ok: true, version: m.version || null, models: Object.keys(m.models || {}), sounds: Object.keys(m.sounds || {}), engineLoops: (m.engineLoops || []).length });
      return m;
    })
    .catch((e) => { state.error = String((e && e.message) || e); return null; });
  return packP;
}

// Scale to the manifest's targetHeight (or targetLength), centre it and stand it on y = 0. The box is taken from the
// bind pose, so skeletons are updated first (a skinned mesh measures itself through its bones).
function prepare(key, def, gltf) {
  const inner = gltf.scene, root = new THREE.Group();
  let skinned = false;
  inner.updateMatrixWorld(true);
  inner.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; o.skeleton.update(); }
  });
  const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
  const want = def.targetHeight ? def.targetHeight / size.y : def.targetLength ? def.targetLength / Math.max(size.x, size.z) : 1;
  const k = Number.isFinite(want) && want > 0 ? want : 1;
  inner.scale.multiplyScalar(k);
  inner.position.set(-(box.min.x + box.max.x) * 0.5 * k, -box.min.y * k, -(box.min.z + box.max.z) * 0.5 * k);
  root.add(inner);
  const clips = {};
  for (const [name, clipName] of Object.entries(def.clips || {})) {
    const c = gltf.animations.find((a) => a.name === clipName);
    if (c) clips[name] = c;
  }
  state.loaded[key] = "ready";
  return { key, root, clips, height: size.y * k, skinned };
}

/**
 * One model from the pack: Promise of { key, root, clips, height, skinned } or null. root faces +Z, feet on y = 0,
 * already at the manifest's size; clips are keyed by the manifest's names (idle, walk, run, attack ...).
 * The result is a template: put copies in the scene with cloneModel().
 */
export function model(key) {
  if (modelCache.has(key)) return modelCache.get(key);
  const p = loadPack().then((m) => {
    const def = m && m.models && m.models[key];
    if (!def || !def.url) return null;
    return new Promise((resolve) => {
      new GLTFLoader().load(def.url, (gltf) => resolve(prepare(key, def, gltf)), undefined, () => { state.loaded[key] = "failed"; resolve(null); });
    });
  }).catch(() => { state.loaded[key] = "failed"; return null; });
  modelCache.set(key, p);
  return p;
}

/** A copy of a template for the scene. Skinned models get their own skeleton (SkeletonUtils.clone). */
export const cloneModel = (t) => (t.skinned ? cloneSkinned(t.root) : t.root.clone(true));

/** The raw bytes of every file under a sound key ("engineLoops" is a key too). Failed files are left out. */
export function sound(key) {
  return loadPack().then((m) => {
    const urls = !m ? [] : key === "engineLoops" ? m.engineLoops || [] : (m.sounds && m.sounds[key]) || [];
    return Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)));
  }).then((list) => list.filter(Boolean));
}

/** The sound keys the pack offers ([] when the manifest did not load). */
export const soundKeys = () => loadPack().then((m) => (m && m.sounds ? Object.keys(m.sounds) : []));

/** For the test hooks: what loaded and what failed. */
export const packState = () => ({ ...state, loaded: { ...state.loaded } });