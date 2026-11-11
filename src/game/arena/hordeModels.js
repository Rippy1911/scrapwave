// Hosted models for the horde (round 14). Figures near the camera are shown as animated models from the asset pack
// (assets/cdnPack.js); everything further out, and every figure whose model has not loaded or failed to load, stays
// the built box-and-ball figure in arena/horde.js. Gameplay never reads any of this: it only decides what is drawn.
import * as THREE from "three";
import { RC } from "@/game/render/frame";
import { model, cloneModel } from "@/game/assets/cdnPack";

// share: part of the horde that wears this model. size: how much bigger than a plain figure (its far LOD is scaled too).
export const HORDE_VARIANTS = {
  zombies: [{ key: "zombie", share: 0.55, size: 1 }, { key: "zombie_b", share: 0.35, size: 1 }, { key: "brute", share: 0.1, size: 1.6 }],
  aliens: [{ key: "alien", share: 0.8, size: 1 }, { key: "alien_heavy", share: 0.2, size: 1.3 }],
};
// v: a random 0..1 kept by the figure.
export function variantFor(kind, v) {
  const list = HORDE_VARIANTS[kind];
  let acc = 0;
  for (const x of list) { acc += x.share; if (v < acc) return x; }
  return list[list.length - 1];
}

const NEAR = 45, FAR = 55; // metres from the camera: a model takes over inside NEAR and hands back outside FAR
const CAP = { low: 10, medium: 18 }; // models on screen at once (28 on High and Ultra)
const NEW_PER_FRAME = 2;

// The pack's alien is teal: the horde's are grey with a big head.
function dress(t) {
  if (t.key !== "alien") return t;
  t.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.name === "Main") m.color.set("#9aa0a6"); });
  const head = t.root.getObjectByName("Head");
  if (head) {
    head.scale.multiplyScalar(1.25);
    for (const c of Object.values(t.clips)) c.tracks = c.tracks.filter((tr) => tr.name !== "Head.scale");
  }
  return t;
}

export function createHordeModels(scene) {
  const tpl = {}, free = {}, used = new Set();

  function load(kind) {
    for (const { key } of HORDE_VARIANTS[kind]) {
      if (key in tpl) continue;
      tpl[key] = null; free[key] = [];
      model(key).then((t) => { if (t) tpl[key] = dress(t); });
    }
  }
  function make(key) {
    const root = cloneModel(tpl[key]);
    scene.add(root);
    return { key, root, mixer: new THREE.AnimationMixer(root), actions: {}, clip: null, action: null, height: tpl[key].height };
  }
  function play(a, name) {
    const clips = tpl[a.key].clips, clip = clips[name] || clips.walk || clips.idle;
    if (!clip || a.clip === clip) return;
    const next = a.actions[clip.name] || (a.actions[clip.name] = a.mixer.clipAction(clip));
    next.reset().fadeIn(0.2).play();
    if (a.action) a.action.fadeOut(0.2);
    a.clip = clip; a.action = next;
  }
  function release(f) {
    const a = f.actor;
    if (!a) return;
    f.actor = null;
    a.root.visible = false;
    used.delete(a); free[a.key].push(a);
  }

  return {
    load, release,
    // Once a rendered frame: hand models out and back by distance, then pose the ones in use. K: the kind's numbers.
    frame(list, K, dt) {
      const cam = RC.camera;
      if (!cam) return;
      const cap = CAP[RC.quality] || 28;
      let made = 0;
      for (const f of list) {
        const d = Math.hypot(f.x - cam.position.x, f.z - cam.position.z);
        if (f.actor && d > FAR) release(f);
        else if (!f.actor && d < NEAR && used.size < cap && tpl[f.va.key]) {
          let a = free[f.va.key].pop();
          if (!a && made < NEW_PER_FRAME) { a = make(f.va.key); made++; }
          if (a) { a.root.visible = true; used.add(a); f.actor = a; }
        }
        const a = f.actor;
        if (!a) continue;
        a.root.position.set(f.x, f.y - (1 - f.rise) * a.height, f.z); // rises out of the ground like the built figure
        a.root.rotation.y = f.yaw;
        play(a, f.claw > 0 ? "attack" : f.target && K.speed > 3 ? "run" : "walk");
        a.mixer.update(dt);
      }
    },
    clear() {
      for (const a of used) { a.root.visible = false; free[a.key].push(a); }
      used.clear();
    },
    state: () => ({ shown: used.size, ready: Object.keys(tpl).filter((k) => tpl[k]), waiting: Object.keys(tpl).filter((k) => !tpl[k]) }),
  };
}